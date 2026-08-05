import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, ChevronDown, Loader2 } from "lucide-react";

const WORKFLOWS = [
  'Australia Student',
  'UK Student',
  'Canada Student',
  'USA Student',
  'Bachelor',
  'Masters',
  'Visa Processing',
  'Finance'
];

interface WorkflowConfig {
  country: string;
  program: string;
  deadline: string;
}

export function WorkflowSelector({ onSelect }: { onSelect: (name: string, config: WorkflowConfig) => Promise<void> }) {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [config, setConfig] = useState<WorkflowConfig>({
    country: "",
    program: "",
    deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedTemplate) return;
    setIsSubmitting(true);
    try {
      await onSelect(selectedTemplate, config);
      setSelectedTemplate(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="lg" className="border-primary/20 hover:border-primary/40">
            <Sparkles className="mr-2 h-4 w-4 text-primary" />
            Workflows
            <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Workflow Templates</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {WORKFLOWS.map((w) => (
            <DropdownMenuItem key={w} onClick={() => setSelectedTemplate(w)}>
              {w}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={!!selectedTemplate} onOpenChange={(open) => !open && setSelectedTemplate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure Workflow: {selectedTemplate}</DialogTitle>
            <DialogDescription>
              Set the context for this workflow to customize generated tasks.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="country">Target Country</Label>
              <Select 
                value={config.country} 
                onValueChange={(v) => setConfig(prev => ({ ...prev, country: v }))}
              >
                <SelectTrigger id="country">
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Australia">Australia</SelectItem>
                  <SelectItem value="UK">UK</SelectItem>
                  <SelectItem value="Canada">Canada</SelectItem>
                  <SelectItem value="USA">USA</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="program">Program / Institution</Label>
              <Input
                id="program"
                placeholder="e.g. Master of Data Science at UTS"
                value={config.program}
                onChange={(e) => setConfig(prev => ({ ...prev, program: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="deadline">Final Deadline</Label>
              <Input
                id="deadline"
                type="date"
                value={config.deadline}
                onChange={(e) => setConfig(prev => ({ ...prev, deadline: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelectedTemplate(null)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Initiate Workflow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}