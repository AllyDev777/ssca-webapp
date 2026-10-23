import type { Metadata } from "next";
import Link from "next/link";
import { AdminNav } from "@/components/AdminNav";
import { LargeTitle } from "@/components/LargeTitle";
import { Segmented } from "@/components/Segmented";
import { searchMembers } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import { withBase } from "@/lib/base-path";
import { memberSearchSchema } from "@/lib/validation";
import styles from "../admin.module.css";

export const metadata: Metadata = { title: "Members" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function href(params: { q: string; sort: string; page?: number }): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.sort !== "name") sp.set("sort", params.sort);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  const s = sp.toString();
  return s ? `/admin/members?${s}` : "/admin/members";
}

export default async function MembersPage({ searchParams }: Props) {
  await requireAdmin();
  const { q, sort, page } = memberSearchSchema.parse(await searchParams);
  const { members, hasNext } = await searchMembers(q, sort, page);

  return (
    <main className="page">
      <LargeTitle title="Members" />
      <AdminNav current="members" />

      <form role="search" method="get" action={withBase("/admin/members")} className={styles.inlineForm}>
        <div className={styles.inlineField}>
          <label htmlFor="member-q" className="visually-hidden">
            Search by name or email
          </label>
          <input
            id="member-q"
            name="q"
            type="search"
            defaultValue={q}
            maxLength={100}
            placeholder="Search name or email"
            className={styles.input}
          />
        </div>
        {sort !== "name" && <input type="hidden" name="sort" value={sort} />}
        <button type="submit" className={styles.secondary}>
          Search
        </button>
      </form>

      <div className={styles.section} style={{ marginTop: 12 }}>
        <Segmented
          label="Sort members"
          value={sort}
          options={[
            { value: "name", label: "Name", href: href({ q, sort: "name" }) },
            { value: "recent", label: "Newest", href: href({ q, sort: "recent" }) },
            { value: "submitted", label: "Most active", href: href({ q, sort: "submitted" }) },
          ]}
        />
      </div>

      <ul className={`card ${styles.list} ${styles.section}`} style={{ marginTop: 12 }}>
        {members.length === 0 ? (
          <li className={styles.empty}>{q ? `No members match “${q}”.` : "No members yet."}</li>
        ) : (
          members.map((m) => (
            <li key={m.id}>
              <Link href={`/admin/members/${m.id}`} className={styles.row}>
                <span className={styles.grow}>
                  <span className={styles.title}>{m.name}</span>
                  <span className={styles.sub}>{m.email}</span>
                </span>
                {m.role === "admin" && (
                  <span className={styles.badge} data-tone="admin">
                    Admin
                  </span>
                )}
                {!m.isActive && (
                  <span className={styles.badge} data-tone="off">
                    Inactive
                  </span>
                )}
                <span className={styles.badge} data-tone={m.thisWeek ?? undefined}>
                  {m.thisWeek === "submitted" ? "Submitted" : m.thisWeek === "draft" ? "Draft" : "—"}
                </span>
                <span className={`${styles.sub} num`} title="Weeks submitted">
                  {m.submitted} wk
                </span>
              </Link>
            </li>
          ))
        )}
      </ul>

      {(page > 1 || hasNext) && (
        <nav className={styles.pager} aria-label="Pages">
          {page > 1 ? <Link href={href({ q, sort, page: page - 1 })}>‹ Previous</Link> : <span />}
          {hasNext && <Link href={href({ q, sort, page: page + 1 })}>Next ›</Link>}
        </nav>
      )}
    </main>
  );
}
