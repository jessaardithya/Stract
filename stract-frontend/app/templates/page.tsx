import TemplatesPage from '@/components/templates/TemplatesPage';

export const metadata = {
  title: 'Stract - Templates',
  description: 'Reusable project and task templates for your workspace',
};

export default function TemplatesRoute() {
  return (
    <main className="min-h-screen bg-[#f7f6f3]">
      <div className="mx-auto max-w-[1320px] px-6 py-8">
        <TemplatesPage />
      </div>
    </main>
  );
}
