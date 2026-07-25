import { redirect } from "next/navigation";

// The kanban board now lives inside the unified tickets page (view toggle,
// top-right). This route only exists so old links keep working.
export default function KanbanRedirect() {
  redirect("/dashboard/tickets");
}
