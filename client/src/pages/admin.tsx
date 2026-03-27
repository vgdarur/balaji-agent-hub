import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { AccessMapping, Agent } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ArrowLeft, Plus, Save, Trash2, Shield, Users, Settings, Edit2 } from "lucide-react";
import { useLocation } from "wouter";

interface MappingsResponse {
  mappings: AccessMapping[];
  agents: Agent[];
}

interface AgentConfig {
  id: string;
  name: string;
  role: string;
  location: string;
  dice_email: string;
  color: string;
  search_term: string;
  active: boolean;
}

const PRESET_COLORS = [
  "hsl(174, 72%, 46%)",
  "hsl(262, 72%, 56%)",
  "hsl(38, 92%, 50%)",
  "hsl(340, 75%, 55%)",
  "hsl(200, 80%, 50%)",
  "hsl(25, 90%, 55%)",
  "hsl(290, 70%, 55%)",
  "hsl(150, 70%, 45%)",
];

export default function AdminPage() {
  const { isAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"access" | "agents">("access");
  const [localMappings, setLocalMappings] = useState<AccessMapping[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);

  // ===== Access Control data =====
  const { data, isLoading } = useQuery<MappingsResponse>({
    queryKey: ["/api/admin/mappings"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/mappings");
      return res.json();
    },
    enabled: isAdmin,
  });

  useEffect(() => {
    if (data?.mappings) {
      setLocalMappings(data.mappings);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", "/api/admin/mappings", { mappings: localMappings });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/mappings"] });
      toast({ title: "Saved", description: "Access mappings updated successfully." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (email: string) => {
      await apiRequest("DELETE", `/api/admin/mappings/${encodeURIComponent(email)}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/mappings"] });
      toast({ title: "Deleted", description: "Mapping removed." });
    },
  });

  const addUserMutation = useMutation({
    mutationFn: async (email: string) => {
      await apiRequest("POST", "/api/admin/mappings", { email, agent_ids: [] });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/mappings"] });
      setNewEmail("");
      setShowAddDialog(false);
      toast({ title: "Added", description: "New user added." });
    },
  });

  // ===== Manage Agents data =====
  const { data: agentConfigs, isLoading: agentsLoading } = useQuery<AgentConfig[]>({
    queryKey: ["/api/admin/agents"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/agents");
      return res.json();
    },
    enabled: isAdmin && activeTab === "agents",
  });

  const [showAddAgent, setShowAddAgent] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AgentConfig | null>(null);
  const [agentForm, setAgentForm] = useState({
    id: "",
    name: "",
    role: "",
    location: "",
    dice_email: "",
    dice_password: "",
    color: PRESET_COLORS[0],
    search_term: "",
  });

  const resetAgentForm = () => {
    setAgentForm({ id: "", name: "", role: "", location: "", dice_email: "", dice_password: "", color: PRESET_COLORS[0], search_term: "" });
    setEditingAgent(null);
  };

  const addAgentMutation = useMutation({
    mutationFn: async () => {
      if (editingAgent) {
        await apiRequest("PUT", `/api/admin/agents/${editingAgent.id}`, agentForm);
      } else {
        await apiRequest("POST", "/api/admin/agents", agentForm);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/agents"] });
      setShowAddAgent(false);
      resetAgentForm();
      toast({ title: editingAgent ? "Updated" : "Added", description: `Agent ${editingAgent ? "updated" : "added"} successfully.` });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteAgentMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/agents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/agents"] });
      toast({ title: "Deleted", description: "Agent removed." });
    },
  });

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Access denied</p>
      </div>
    );
  }

  const agents = data?.agents || [];

  function toggleAgent(email: string, agentId: string) {
    setLocalMappings((prev) =>
      prev.map((m) => {
        if (m.email !== email) return m;
        const has = m.agent_ids.includes(agentId);
        return {
          ...m,
          agent_ids: has
            ? m.agent_ids.filter((id) => id !== agentId)
            : [...m.agent_ids, agentId],
        };
      })
    );
  }

  function maskEmail(email: string) {
    if (!email) return "—";
    const [local, domain] = email.split("@");
    if (!domain) return email;
    return local.slice(0, 3) + "***@" + domain;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/")}
            className="text-gray-600 hover:text-gray-900"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900" data-testid="text-admin-title">
              Admin Panel
            </h1>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab("access")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "access"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Users className="w-4 h-4 inline mr-1.5" />
            Access Control
          </button>
          <button
            onClick={() => setActiveTab("agents")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "agents"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Settings className="w-4 h-4 inline mr-1.5" />
            Manage Agents
          </button>
        </div>

        {/* ===== ACCESS CONTROL TAB ===== */}
        {activeTab === "access" && (
          <>
            <div className="flex justify-end gap-2 mb-4">
              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="border-gray-200" data-testid="button-add-user">
                    <Plus className="w-4 h-4 mr-1" />
                    Add User
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New User</DialogTitle>
                  </DialogHeader>
                  <div className="flex gap-2 mt-4">
                    <Input
                      placeholder="user@example.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      data-testid="input-new-email"
                    />
                    <Button
                      onClick={() => addUserMutation.mutate(newEmail)}
                      disabled={!newEmail || addUserMutation.isPending}
                      data-testid="button-confirm-add"
                    >
                      Add
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Button
                size="sm"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
                data-testid="button-save-all"
              >
                <Save className="w-4 h-4 mr-1" />
                {saveMutation.isPending ? "Saving..." : "Save All"}
              </Button>
            </div>

            <Card className="bg-white border-gray-200 overflow-hidden shadow-sm">
              <CardHeader className="pb-2 bg-gray-50 border-b border-gray-100">
                <CardTitle className="text-base flex items-center gap-2 text-gray-700">
                  <Users className="w-4 h-4" />
                  Email → Agent Access Mappings
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="text-left px-4 py-3 font-medium text-gray-500 sticky left-0 bg-gray-50 z-10 min-w-[200px]">
                          Email
                        </th>
                        {agents.map((agent) => (
                          <th
                            key={agent.id}
                            className="text-center px-2 py-3 font-medium text-gray-500 whitespace-nowrap"
                          >
                            <div className="flex flex-col items-center gap-1">
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: agent.color }}
                              />
                              <span className="text-xs">{agent.name.split(" ")[0]}</span>
                            </div>
                          </th>
                        ))}
                        <th className="px-4 py-3 w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                          <tr key={i} className="border-b border-gray-100">
                            <td colSpan={agents.length + 2} className="px-4 py-3">
                              <div className="h-4 bg-gray-100 rounded animate-pulse" />
                            </td>
                          </tr>
                        ))
                      ) : (
                        localMappings.map((mapping) => (
                          <tr
                            key={mapping.email}
                            className="border-b border-gray-100 hover:bg-gray-50"
                            data-testid={`row-mapping-${mapping.email}`}
                          >
                            <td className="px-4 py-3 font-mono text-xs sticky left-0 bg-white z-10 text-gray-700">
                              {mapping.email}
                            </td>
                            {agents.map((agent) => (
                              <td key={agent.id} className="text-center px-2 py-3">
                                <Checkbox
                                  checked={mapping.agent_ids.includes(agent.id)}
                                  onCheckedChange={() =>
                                    toggleAgent(mapping.email, agent.id)
                                  }
                                  data-testid={`checkbox-${mapping.email}-${agent.id}`}
                                />
                              </td>
                            ))}
                            <td className="px-4 py-3">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-gray-400 hover:text-red-600"
                                onClick={() => {
                                  setLocalMappings((prev) =>
                                    prev.filter((m) => m.email !== mapping.email)
                                  );
                                  deleteMutation.mutate(mapping.email);
                                }}
                                data-testid={`button-delete-${mapping.email}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* ===== MANAGE AGENTS TAB ===== */}
        {activeTab === "agents" && (
          <>
            <div className="flex justify-end mb-4">
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => {
                  resetAgentForm();
                  setShowAddAgent(true);
                }}
              >
                <Plus className="w-4 h-4 mr-1" />
                Add New Agent
              </Button>
            </div>

            {agentsLoading ? (
              <div className="text-center py-20 text-gray-400">Loading agents...</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(agentConfigs || []).map((ac) => (
                  <div
                    key={ac.id}
                    className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: ac.color }}
                      />
                      <span className="text-sm font-bold text-gray-900">{ac.name}</span>
                      <span className={`ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ac.active !== false ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                        {ac.active !== false ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-1">{ac.role}</p>
                    <p className="text-xs text-gray-400 mb-1">{ac.location}</p>
                    <p className="text-xs text-gray-400 mb-3">Dice: {maskEmail(ac.dice_email)}</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingAgent(ac);
                          setAgentForm({
                            id: ac.id,
                            name: ac.name,
                            role: ac.role,
                            location: ac.location,
                            dice_email: ac.dice_email || "",
                            dice_password: "",
                            color: ac.color,
                            search_term: ac.search_term || "",
                          });
                          setShowAddAgent(true);
                        }}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        <Edit2 className="w-3 h-3" />
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete agent "${ac.name}"?`)) {
                            deleteAgentMutation.mutate(ac.id);
                          }
                        }}
                        className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 font-medium"
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add/Edit Agent Dialog */}
            <Dialog open={showAddAgent} onOpenChange={(open) => { setShowAddAgent(open); if (!open) resetAgentForm(); }}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingAgent ? "Edit Agent" : "Add New Agent"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 mt-2">
                  {!editingAgent && (
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Agent ID</label>
                      <Input
                        placeholder="e.g. johnja1"
                        value={agentForm.id}
                        onChange={(e) => setAgentForm((f) => ({ ...f, id: e.target.value }))}
                      />
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Name</label>
                    <Input
                      placeholder="Full Name"
                      value={agentForm.name}
                      onChange={(e) => setAgentForm((f) => ({ ...f, name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Role</label>
                    <Input
                      placeholder="e.g. Java Full Stack Developer"
                      value={agentForm.role}
                      onChange={(e) => setAgentForm((f) => ({ ...f, role: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Location</label>
                    <Input
                      placeholder="e.g. Dallas/Remote"
                      value={agentForm.location}
                      onChange={(e) => setAgentForm((f) => ({ ...f, location: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Dice Email</label>
                    <Input
                      placeholder="dice@email.com"
                      value={agentForm.dice_email}
                      onChange={(e) => setAgentForm((f) => ({ ...f, dice_email: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Dice Password</label>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={agentForm.dice_password}
                      onChange={(e) => setAgentForm((f) => ({ ...f, dice_password: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Search Term</label>
                    <Input
                      placeholder="What to search on Dice"
                      value={agentForm.search_term}
                      onChange={(e) => setAgentForm((f) => ({ ...f, search_term: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Color</label>
                    <div className="flex gap-2 flex-wrap">
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => setAgentForm((f) => ({ ...f, color: c }))}
                          className={`w-7 h-7 rounded-full border-2 transition-all ${
                            agentForm.color === c ? "border-gray-900 scale-110" : "border-transparent"
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                  <Button
                    className="w-full bg-blue-600 hover:bg-blue-700 mt-2"
                    onClick={() => addAgentMutation.mutate()}
                    disabled={addAgentMutation.isPending || (!editingAgent && !agentForm.id) || !agentForm.name}
                  >
                    {addAgentMutation.isPending ? "Saving..." : editingAgent ? "Update Agent" : "Add Agent"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}

        {/* Footer */}
        <footer className="mt-8 pb-4 text-center">
          <a
            href="https://www.perplexity.ai/computer"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Balaji Agent Hub · Powered by Perplexity Computer
          </a>
        </footer>
      </div>
    </div>
  );
}
