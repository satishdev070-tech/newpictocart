import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui/layout";
import { EmptyState } from "@/components/ui/states";
import { TeamMemberForm } from "@/features/informative/panel/content-forms";
import { RowControls } from "@/features/informative/panel/ui";
import { requireInformativeTenant } from "@/features/informative/server/context";
import { listTeam } from "@/features/informative/server/repo";
import { assetUrl } from "@/lib/storage/assets";

export const metadata: Metadata = { title: "Team" };

export default async function InformativeTeamPage() {
  const ctx = await requireInformativeTenant();
  const team = await listTeam(ctx);
  const canWrite = ctx.permissions.has("content.write");
  return (
    <>
      <PageHeader title="Team" description="Trainers, doctors, stylists: the people your clients will meet." />
      {canWrite ? (
        <Card title="Add a team member" className="mb-6">
          <details>
            <summary className="cursor-pointer text-small font-medium text-accent">Add member</summary>
            <div className="mt-4"><TeamMemberForm /></div>
          </details>
        </Card>
      ) : null}
      {team.length === 0 ? (
        <EmptyState title="No team members yet" description="Tip: a friendly photo and one line about each person makes visitors more likely to get in touch." />
      ) : (
        <ul className="space-y-4">
          {team.map((m, i) => (
            <li key={m.id}>
              <Card title={m.name} description={m.role ?? undefined} actions={canWrite ? <RowControls kind="team" id={m.id} label={m.name} first={i === 0} last={i === team.length - 1} /> : null}>
                {canWrite ? (
                  <details>
                    <summary className="cursor-pointer text-small font-medium">Edit</summary>
                    <div className="mt-4"><TeamMemberForm member={m} photoUrl={assetUrl(m.photoPath)} /></div>
                  </details>
                ) : <p className="text-small text-muted">{m.bio}</p>}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
