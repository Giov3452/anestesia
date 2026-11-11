"use client";

import { useEffect, useRef, useState } from "react";
import { createPersonalTrainerClient } from "@/lib/personal-trainer/client";

type DiaryPost = { id:string; title:string; body_html:string; created_at:string; updated_at:string; is_pinned:boolean; pinned_at:string|null };

function sanitizeHtml(input:string) {
  if (typeof window === "undefined") return "";
  const parsed = new DOMParser().parseFromString(input, "text/html");
  const allowed = new Set(["P","BR","STRONG","B","EM","I","U","UL","OL","LI","BLOCKQUOTE","H2","H3","DIV"]);
  const clean = (node:Node) => {
    [...node.childNodes].forEach(child => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement;
        if (!allowed.has(el.tagName)) {
          const fragment = document.createDocumentFragment();
          while (el.firstChild) fragment.appendChild(el.firstChild);
          el.replaceWith(fragment);
          clean(node);
          return;
        }
        [...el.attributes].forEach(attr => el.removeAttribute(attr.name));
        clean(el);
      } else if (child.nodeType !== Node.TEXT_NODE) child.remove();
    });
  };
  clean(parsed.body);
  return parsed.body.innerHTML;
}

function plainText(html:string) {
  if (typeof window === "undefined") return "";
  const doc = new DOMParser().parseFromString(sanitizeHtml(html), "text/html");
  return doc.body.textContent ?? "";
}

export default function DiarioClient({ initialPosts }: { initialPosts:DiaryPost[] }) {
  const [posts,setPosts] = useState(initialPosts);
  const [editingId,setEditingId] = useState<string|null>(null);
  const [title,setTitle] = useState("");
  const [body,setBody] = useState("");
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = sanitizeHtml(body);
  }, [editingId]);

  function startNew() {
    setEditingId("new"); setTitle(""); setBody(""); setError("");
    if (editorRef.current) editorRef.current.innerHTML = "";
  }
  function startEdit(post:DiaryPost) {
    setEditingId(post.id); setTitle(post.title); setBody(post.body_html); setError("");
    if (editorRef.current) editorRef.current.innerHTML = sanitizeHtml(post.body_html);
  }
  function cancelEdit() {
    setEditingId(null); setTitle(""); setBody(""); setError("");
  }
  function format(command:string, value?:string) {
    editorRef.current?.focus();
    document.execCommand(command,false,value);
    if (editorRef.current) setBody(sanitizeHtml(editorRef.current.innerHTML));
  }
  async function save() {
    setError("");
    const cleanTitle = title.trim();
    const cleanBody = sanitizeHtml(editorRef.current?.innerHTML ?? body);
    if (!cleanTitle) { setError("Inserisci un titolo."); return; }
    if (cleanTitle.length > 200) { setError("Il titolo non può superare 200 caratteri."); return; }
    if (!plainText(cleanBody).trim()) { setError("Inserisci il testo del post."); return; }
    setBusy(true);
    const supabase = createPersonalTrainerClient();
    if (editingId === "new") {
      const { data, error } = await supabase.from("pt_diary_posts").insert({ title:cleanTitle, body_html:cleanBody }).select("id,title,body_html,created_at,updated_at,is_pinned,pinned_at").single();
      if (error) setError("Salvataggio non riuscito: " + error.message);
      else { setPosts(current => [data as DiaryPost, ...current]); cancelEdit(); }
    } else if (editingId) {
      const { data, error } = await supabase.from("pt_diary_posts").update({ title:cleanTitle, body_html:cleanBody, updated_at:new Date().toISOString() }).eq("id",editingId).select("id,title,body_html,created_at,updated_at").single();
      if (error) setError("Modifica non riuscita: " + error.message);
      else { setPosts(current => current.map(post => post.id === editingId ? data as DiaryPost : post).sort((a,b)=>b.updated_at.localeCompare(a.updated_at))); cancelEdit(); }
    }
    setBusy(false);
  }
  async function togglePin(post:DiaryPost) {\n    setError(""); setBusy(true);\n    const nextPinned = !post.is_pinned;\n    const { data, error } = await createPersonalTrainerClient().from("pt_diary_posts").update({ is_pinned:nextPinned, pinned_at:nextPinned ? new Date().toISOString() : null }).eq("id",post.id).select("id,title,body_html,created_at,updated_at,is_pinned,pinned_at").single();\n    if (error) setError("Impossibile aggiornare il post fissato: " + error.message);\n    else setPosts(current => [...current.filter(item=>item.id!==post.id), data as DiaryPost].sort((a,b)=>Number(b.is_pinned)-Number(a.is_pinned) || (b.pinned_at??"").localeCompare(a.pinned_at??"") || b.updated_at.localeCompare(a.updated_at)));\n    setBusy(false);\n  }\n  async function remove(post:DiaryPost) {
    if (!window.confirm("Vuoi eliminare definitivamente questo post dal tuo diario?")) return;
    setError(""); setBusy(true);
    const { error } = await createPersonalTrainerClient().from("pt_diary_posts").delete().eq("id",post.id);
    if (error) setError("Eliminazione non riuscita: " + error.message);
    else setPosts(current => current.filter(item => item.id !== post.id));
    setBusy(false);
  }

  return <section className="pt-page pt-diary">
    <div className="pt-eyebrow">SPAZIO PERSONALE E PRIVATO</div>
    <div className="pt-diary-heading"><div><h2>Diario</h2><p className="pt-muted">Uno spazio riservato ai tuoi pensieri e appunti personali.</p></div><button className="pt-button" onClick={startNew} disabled={busy}>+ Nuovo post</button></div>
    {editingId && <article className="pt-card pt-diary-editor">
      <h3>{editingId === "new" ? "Nuovo post" : "Modifica post"}</h3>
      <div className="pt-field"><label htmlFor="pt-diary-title">Titolo</label><input id="pt-diary-title" className="pt-diary-title-input" value={title} maxLength={200} onChange={e=>setTitle(e.target.value)} placeholder="Titolo del tuo post" /></div>
      <div className="pt-field"><label>Testo</label>
        <div className="pt-rich-toolbar" role="toolbar" aria-label="Formattazione testo">
          <button type="button" onClick={()=>format("bold")} title="Grassetto"><strong>B</strong></button>
          <button type="button" onClick={()=>format("italic")} title="Corsivo"><em>I</em></button>
          <button type="button" onClick={()=>format("underline")} title="Sottolineato"><u>U</u></button>
          <span className="pt-rich-separator" />
          <button type="button" onClick={()=>format("formatBlock","h2")} title="Titolo">H2</button>
          <button type="button" onClick={()=>format("formatBlock","h3")} title="Sottotitolo">H3</button>
          <button type="button" onClick={()=>format("insertUnorderedList")} title="Elenco puntato">• Elenco</button>
          <button type="button" onClick={()=>format("insertOrderedList")} title="Elenco numerato">1. Elenco</button>
          <button type="button" onClick={()=>format("formatBlock","blockquote")} title="Citazione">❝</button>
          <button type="button" onClick={()=>format("removeFormat")} title="Rimuovi formattazione">Tx</button>
        </div>
        <div ref={editorRef} className="pt-rich-editor" contentEditable suppressContentEditableWarning role="textbox" aria-label="Testo del post" aria-multiline="true" data-placeholder="Scrivi qui i tuoi pensieri..." onInput={e=>setBody(sanitizeHtml(e.currentTarget.innerHTML))} />
      </div>
      {error && <p className="pt-error" role="alert">{error}</p>}
      <div className="pt-photo-actions"><button className="pt-button" onClick={save} disabled={busy}>{busy?"Salvataggio…":"Salva post"}</button><button className="pt-secondary-button" onClick={cancelEdit} disabled={busy}>Annulla</button></div>
    </article>}
    {error && !editingId && <p className="pt-error" role="alert">{error}</p>}
    <div className="pt-diary-list">
      {posts.length===0 ? <div className="pt-empty">Il diario è ancora vuoto. Crea il tuo primo post.</div> : posts.map(post=><article className="pt-card pt-diary-post" key={post.id}>
        <div className="pt-diary-post-heading">{post.is_pinned && <span className="pt-diary-pin-label">📌 Fissato</span>}<h3>{post.title}</h3></div>
        <div className="pt-diary-post-body" dangerouslySetInnerHTML={{__html:sanitizeHtml(post.body_html)}} />
        <div className="pt-diary-post-footer"><small>Ultima modifica: {new Date(post.updated_at).toLocaleString("it-IT",{timeZone:"Europe/Rome",dateStyle:"medium",timeStyle:"short"})}</small><div className="pt-photo-actions"><button className="pt-secondary-button" disabled={busy} onClick={()=>togglePin(post)}>{post.is_pinned ? "Rimuovi dai fissati" : "📌 Fissa in alto"}</button><button className="pt-secondary-button" disabled={busy} onClick={()=>startEdit(post)}>Modifica</button><button className="pt-secondary-button pt-diary-delete" disabled={busy} onClick={()=>remove(post)}>Elimina</button></div></div>
      </article>)}
    </div>
  </section>;
}
