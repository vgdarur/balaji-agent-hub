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
import { ArrowLeft, Plus, Save, Trash2, Shield, Users } from "lucide-react";
import { useLocation } from "wouter";

interface MappingsResponse {
  mappings: AccessMapping[];
  agents: Agent[];
}

export default function AdminPage() {
  const { isAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [localMappings, setLocalMappings] = useState<AccessMapping[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);

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

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Access denied</p>
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

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/")}
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground" data-testid="text-admin-title">
              Admin Panel
            </h1>
          </div>
          <div className="ml-auto flex gap-2">
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" data-testid="button-add-user">
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
              data-testid="button-save-all"
            >
              <Save className="w-4 h-4 mr-1" />
              {saveMutation.isPending ? "Saving..." : "Save All"}
            </Button>
          </div>
        </div>

        {/* Mappings Table */}
        <Card className="bg-card border-card-border overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" />
              Email → Agent Access Mappings
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground sticky left-0 bg-muted/30 z-10 min-w-[200px]">
                      Email
                    </th>
                    {agents.map((agent) => (
                      <th
                        key={agent.id}
                        className="text-center px-2 py-3 font-medium text-muted-foreground whitespace-nowrap"
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
                      <tr key={i} className="border-b border-border">
                        <td colSpan={agents.length + 2} className="px-4 py-3">
                          <div className="h-4 bg-muted rounded animate-pulse" />
                        </td>
                      </tr>
                    ))
                  ) : (
                    localMappings.map((mapping) => (
                      <tr
                        key={mapping.email}
                        className="border-b border-border hover:bg-muted/20"
                        data-testid={`row-mapping-${mapping.email}`}
                      >
                        <td className="px-4 py-3 font-mono text-xs sticky left-0 bg-card z-10">
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
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
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

        {/* Footer */}
        <footer className="mt-8 pb-4 text-center">
          <a
            href="https://www.perplexity.ai/computer"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Balaji Agent Hub · Powered by Perplexity Computer
          </a>
        </footer>
      </div>
    </div>
  );
}
