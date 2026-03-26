// Shared types for Balaji Agent Hub

export interface HubJob {
  id: number;
  title: string;
  company: string;
  location: string;
  job_url: string;
  source: string;
  status: string;
  agent: string;
  employment_type: string | null;
  created_at: string;
}

export interface AgentRun {
  id: number;
  agent: string;
  run_date: string;
  jobs_found: number;
  sources_searched: string | null;
  status: string;
  completed_at: string;
}

export interface AccessMapping {
  email: string;
  agent_ids: string[];
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  location: string;
  color: string;
}

export const agents: Agent[] = [
  { id: "venuja1", name: "Venu Gopal", role: "Software Manager (LinkedIn)", location: "Atlanta/Remote", color: "hsl(174, 72%, 46%)" },
  { id: "krishnaja1", name: "V Krishna", role: "C2C Java Fullstack", location: "Dallas/Remote", color: "hsl(262, 72%, 56%)" },
  { id: "udayja1", name: "Uday Kumar", role: "C2C Front-End Dev", location: "Atlanta/Remote", color: "hsl(38, 92%, 50%)" },
  { id: "shasheeja1", name: "Shashi Kumar", role: "C2C DevOps/SRE", location: "Remote", color: "hsl(340, 75%, 55%)" },
  { id: "rajja1", name: "Raja Vamshi", role: "C2C Java Fullstack", location: "Remote", color: "hsl(200, 80%, 50%)" },
  { id: "dunteesja1", name: "Dunteesh", role: "C2C Python Dev", location: "Remote", color: "hsl(25, 90%, 55%)" },
  { id: "purvaja1", name: "Purva", role: "C2C Technical Writer", location: "Remote", color: "hsl(290, 70%, 55%)" },
  { id: "ramanaja1", name: "Ramana", role: "C2C React Dev", location: "Remote", color: "hsl(150, 70%, 45%)" },
];

export const defaultEmailToAgentMap: Record<string, string[]> = {
  // Admin
  "vgdarur@gmail.com": ["venuja1","krishnaja1","udayja1","shasheeja1","rajja1","dunteesja1","purvaja1","ramanaja1"],
  // Recruiters — see all candidates
  "ankitkamra1920@gmail.com": ["venuja1","krishnaja1","udayja1","shasheeja1","rajja1","dunteesja1","purvaja1","ramanaja1"],
  "pavansurya2701@gmail.com": ["venuja1","krishnaja1","udayja1","shasheeja1","rajja1","dunteesja1","purvaja1","ramanaja1"],
  "vamshinv9@gmail.com": ["venuja1","krishnaja1","udayja1","shasheeja1","rajja1","dunteesja1","purvaja1","ramanaja1"],
  "venubhavana@gmail.com": ["venuja1","krishnaja1","udayja1","shasheeja1","rajja1","dunteesja1","purvaja1","ramanaja1"],
  // Candidates — see only their own
  "chitturiuday@gmail.com": ["udayja1"],
  "shashidevops6@gmail.com": ["shasheeja1"],
  "rajavamshisvln@gmail.com": ["rajja1"],
  "dunti0001@gmail.com": ["dunteesja1"],
  "purvat.111@gmail.com": ["purvaja1"],
  "karetiramanakumar@gmail.com": ["ramanaja1"],
  "stupbill@gmail.com": ["krishnaja1"],
  "udaykcdec@gmail.com": ["udayja1"],
};

export const adminEmails = ["vgdarur@gmail.com"];

// Recruiters can see all agents and update job statuses on behalf of candidates
export const recruiterEmails = [
  "ankitkamra1920@gmail.com",
  "pavansurya2701@gmail.com",
  "vamshinv9@gmail.com",
  "venubhavana@gmail.com",
];

export const JOB_STATUSES = ["New", "Applied", "Interview", "Offer", "Rejected", "Pending", "Skipped"] as const;
export type JobStatus = typeof JOB_STATUSES[number];
