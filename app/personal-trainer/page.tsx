import { redirect } from "next/navigation";
import { requirePersonalTrainerProfile } from "@/lib/personal-trainer/auth";
export default async function PersonalTrainerIndexPage() {
  await requirePersonalTrainerProfile();
  redirect("/personal-trainer/dashboard");
}
