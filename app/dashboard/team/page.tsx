"use client";

import { useState } from "react";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "agent";
  listings_count: number;
  leads_count: number;
  joined_at: string;
}

const MOCK_TEAM: TeamMember[] = [
  {
    id: "1",
    name: "Mario Rossi",
    email: "mario@agenzia.it",
    role: "owner",
    listings_count: 15,
    leads_count: 42,
    joined_at: "2025-01-15",
  },
  {
    id: "2",
    name: "Laura Verdi",
    email: "laura@agenzia.it",
    role: "agent",
    listings_count: 8,
    leads_count: 23,
    joined_at: "2025-06-01",
  },
];

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  owner: { label: "Titolare", color: "bg-purple-100 text-purple-700" },
  admin: { label: "Admin", color: "bg-blue-100 text-blue-700" },
  agent: { label: "Agente", color: "bg-gray-100 text-gray-700" },
};

export default function TeamPage() {
  const [team] = useState<TeamMember[]>(MOCK_TEAM);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("agent");
  const [inviting, setInviting] = useState(false);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    // In production: POST /api/team/invite
    await new Promise((r) => setTimeout(r, 1000));
    setInviteEmail("");
    setInviting(false);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Gestione team</h1>
      <p className="mt-1 text-sm text-gray-500">
        Invita agenti e gestisci i ruoli del tuo team
      </p>

      {/* Invite form */}
      <form
        onSubmit={handleInvite}
        className="mt-6 flex items-end gap-3 rounded-xl border border-gray-200 bg-white p-5"
      >
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            type="email"
            required
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="agente@email.com"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="w-40">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Ruolo
          </label>
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="agent">Agente</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={inviting}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {inviting ? "Invio..." : "Invita"}
        </button>
      </form>

      {/* Team list */}
      <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Membro</th>
              <th className="px-4 py-3 font-medium">Ruolo</th>
              <th className="px-4 py-3 font-medium">Annunci</th>
              <th className="px-4 py-3 font-medium">Lead</th>
              <th className="px-4 py-3 font-medium">Ingresso</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {team.map((m) => (
              <tr key={m.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{m.name}</p>
                  <p className="text-xs text-gray-500">{m.email}</p>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_LABELS[m.role]?.color}`}
                  >
                    {ROLE_LABELS[m.role]?.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{m.listings_count}</td>
                <td className="px-4 py-3 text-gray-600">{m.leads_count}</td>
                <td className="px-4 py-3 text-gray-600">
                  {new Date(m.joined_at).toLocaleDateString("it-IT")}
                </td>
                <td className="px-4 py-3 text-right">
                  {m.role !== "owner" && (
                    <button className="text-xs text-red-500 hover:text-red-700">
                      Rimuovi
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
