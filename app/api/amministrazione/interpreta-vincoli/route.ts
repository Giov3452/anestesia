import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {validateParsedRule, type ParsedGeneratorRule} from "@/lib/generator-rules";

export const runtime = "nodejs";
export const maxDuration = 60;

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    version: {type: "integer", enum: [1]},
    status: {type: "string", enum: ["supported", "needs_review"]},
    kind: {type: "string", enum: ["require_shift_daily","require_shift_for_user","forbid_shift_for_user","forbid_shift_for_role","allowed_weekdays_for_role","max_shifts_per_user_day","rest_after_shift","fair_distribution","hide_shift","unknown"]},
    shiftCodes: {type: "array", items: {type: "string"}},
    count: {type: ["integer","null"]},
    weekdays: {type: ["array","null"], items: {type: "integer", minimum: 0, maximum: 6}},
    excludeHolidays: {type: "boolean"},
    username: {type: ["string","null"]},
    employmentRoles: {type: "array", items: {type: "string", enum: ["strutturato","calabria","part_time"]}},
    service: {type: ["string","null"]},
    allowedWeekdays: {type: ["array","null"], items: {type: "integer", minimum: 0, maximum: 6}},
    maxPerUserDay: {type: ["integer","null"]},
    afterShiftCodes: {type: "array", items: {type: "string"}},
    rationale: {type: "string"},
    unsupportedReason: {type: ["string","null"]}
  },
  required: ["version","status","kind","shiftCodes","count","weekdays","excludeHolidays","username","employmentRoles","service","allowedWeekdays","maxPerUserDay","afterShiftCodes","rationale","unsupportedReason"]
} as const;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error:"Autenticazione richiesta."}, {status:401});
    const [{data: profile},{data: roleRpc}] = await Promise.all([
      supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
      supabase.rpc("get_my_role")
    ]);
    const role = String(profile?.role || roleRpc || "").toLowerCase();
    if (!["admin","super_admin"].includes(role)) return NextResponse.json({error:"Operazione riservata agli amministratori."}, {status:403});

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({error:"Manca OPENAI_API_KEY nell'ambiente server. Nessun vincolo è stato modificato."}, {status:503});
    const body = await request.json().catch(()=>({}));
    const ids = Array.isArray(body?.ids) ? body.ids.filter((id: unknown)=>Number.isInteger(id)) : null;
    let query = supabase.from("generator_constraints").select("id,code,name,description,enabled,config").order("id");
    if (ids?.length) query = query.in("id", ids);
    const {data: constraints,error: readError} = await query;
    if (readError) throw readError;
    const active = (constraints || []).filter((r:any)=>r.enabled);
    if (!active.length) return NextResponse.json({processed:0, supported:0, needsReview:0, results:[]});

    const model = process.env.OPENAI_RULE_MODEL || "gpt-4.1-mini";
    const prompt = `Convert each Italian staffing constraint into exactly one conservative structured rule for a deterministic shift scheduler. Never invent details. If a constraint combines multiple independent rules or its meaning is ambiguous, use status needs_review and kind unknown. Do not treat a rule as supported unless the operation and every relevant parameter are representable. Weekdays use JavaScript numbers: Sunday 0, Monday 1, Tuesday 2, Wednesday 3, Thursday 4, Friday 5, Saturday 6. Shift short codes must be copied from the text only when explicit; infer a code from a name like "notte" only when unambiguous. Usernames should be copied exactly when explicit. For "only", use a forbid/allowed-days rule as appropriate. Use require_shift_daily for coverage requirements. Use max_shifts_per_user_day for per-person daily caps. Use rest_after_shift for rest after a shift. Use fair_distribution for balancing. hide_shift is display-only and does not schedule. Current available employment roles: strutturato, calabria, part_time. Rules:\n${active.map((r:any)=>JSON.stringify({id:r.id,code:r.code,name:r.name,description:r.description})).join("\n")}`;
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method:"POST",
      headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},
      body:JSON.stringify({
        model,
        temperature:0,
        messages:[
          {role:"system",content:"You are a strict constraint compiler. Output only schema-valid data. Do not provide scheduling advice or assume undocumented policy."},
          {role:"user",content:prompt}
        ],
        response_format:{type:"json_schema",json_schema:{name:"constraint_compilation",strict:true,schema:{type:"object",additionalProperties:false,properties:{rules:{type:"array",items:{type:"object",additionalProperties:false,properties:{id:{type:"integer"},parsedRule:schema},required:["id","parsedRule"]}}},required:["rules"]}}}
      })
    });
    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json({error:`Errore del servizio AI (${response.status}): ${detail.slice(0,500)}. Nessun vincolo è stato modificato.`},{status:502});
    }
    const payload:any = await response.json();
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("Il servizio AI non ha restituito regole.");
    const compiled = JSON.parse(content) as {rules:{id:number;parsedRule:ParsedGeneratorRule}[]};
    const byId = new Map<number,ParsedGeneratorRule>((compiled.rules || []).map(item=>[item.id,item.parsedRule] as const));
    const results:any[] = [];
    for (const constraint of active as any[]) {
      const parsed = byId.get(constraint.id);
      const valid = validateParsedRule(parsed);
      const safeRule:ParsedGeneratorRule = valid ? parsed! : {
        version:1,status:"needs_review",kind:"unknown",shiftCodes:[],count:null,weekdays:null,
        excludeHolidays:false,username:null,employmentRoles:[],service:null,allowedWeekdays:null,
        maxPerUserDay:null,afterShiftCodes:[],rationale:"",unsupportedReason:"Output AI assente o non valido."
      };
      const unsupported =
        (safeRule.kind === "require_shift_daily" && (!safeRule.shiftCodes.length || ((safeRule.count ?? 1) > 1 && safeRule.shiftCodes.length < (safeRule.count ?? 1)) || safeRule.username !== null || safeRule.employmentRoles.length > 0)) ||
        (safeRule.kind === "require_shift_for_user" && (!safeRule.username || !safeRule.shiftCodes.length)) ||
        (safeRule.kind === "forbid_shift_for_user" && (!safeRule.username || !safeRule.shiftCodes.length)) ||
        (safeRule.kind === "forbid_shift_for_role" && (!safeRule.employmentRoles.length || !safeRule.shiftCodes.length)) ||
        (safeRule.kind === "allowed_weekdays_for_role" && (!safeRule.employmentRoles.length || !safeRule.allowedWeekdays?.length)) ||
        (safeRule.kind === "rest_after_shift" && !safeRule.afterShiftCodes.length) ||
        (safeRule.kind === "max_shifts_per_user_day" && (safeRule.maxPerUserDay ?? 1) !== 1) ||
        safeRule.kind === "unknown" ||
        (safeRule.kind === "fair_distribution" && !/weekend|fine settimana|sabato|domenica/i.test(String((active as any[]).find((r:any)=>r.id===constraint.id)?.name||"")+" "+String((active as any[]).find((r:any)=>r.id===constraint.id)?.description||"")));
      if (unsupported) {
        safeRule.status = "needs_review";
        safeRule.unsupportedReason = safeRule.unsupportedReason || "La regola richiede parametri mancanti o una funzione non ancora implementata nel motore.";
      }
      const config = {...(constraint.config || {}),parsed_rule:safeRule,parsed_at:new Date().toISOString(),parsed_model:model};
      const {error:updateError} = await supabase.from("generator_constraints").update({config}).eq("id",constraint.id);
      if (updateError) throw updateError;
      results.push({id:constraint.id,name:constraint.name,status:safeRule.status,kind:safeRule.kind,reason:safeRule.unsupportedReason});
    }
    return NextResponse.json({processed:results.length,supported:results.filter(r=>r.status==="supported").length,needsReview:results.filter(r=>r.status!=="supported").length,results});
  } catch (error) {
    return NextResponse.json({error:error instanceof Error?error.message:"Errore inatteso durante l'interpretazione."},{status:500});
  }
}
