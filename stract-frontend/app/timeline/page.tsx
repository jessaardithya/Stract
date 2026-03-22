import TimelineView from "@/components/views/TimelineView";

export const metadata = {
  title: "Stract - Timeline",
  description: "Static timeline rendering for scheduled project tasks",
};

export default function TimelinePage() {
  return (
    <main className="min-h-screen bg-[#f7f6f3]">
      <div className="mx-auto max-w-[1240px] px-6 py-8">
        <TimelineView />
      </div>
    </main>
  );
}
