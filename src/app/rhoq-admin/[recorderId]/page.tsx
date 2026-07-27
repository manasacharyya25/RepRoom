import { RhoqAdminRecorderDetail } from "@/components/admin/RhoqAdminRecorderDetail";
import "@/app/rhoq-admin.css";
import "@/app/onboard-recorder.css";

type PageProps = {
  params: Promise<{ recorderId: string }>;
};

export default async function RhoqAdminRecorderPage({ params }: PageProps) {
  const { recorderId } = await params;
  return <RhoqAdminRecorderDetail recorderId={recorderId.trim()} />;
}
