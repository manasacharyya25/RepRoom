import { ReferralInviteLanding } from "@/app/r/[code]/ReferralInviteLanding";

type InvitePageProps = {
  params: Promise<{ code: string }>;
};

export default async function ReferralInvitePage({ params }: InvitePageProps) {
  const { code } = await params;
  return <ReferralInviteLanding code={code ?? ""} />;
}
