import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sparkles, ChevronDown } from "lucide-react";

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

export function WorkflowSelector({ onSelect }: { onSelect: (name: string) => void }) {
  return (
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
          <DropdownMenuItem key={w} onClick={() => onSelect(w)}>
            {w}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
