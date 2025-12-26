import EditResourcePage from './EditResourcePage';

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <EditResourcePage params={params} />;
}
