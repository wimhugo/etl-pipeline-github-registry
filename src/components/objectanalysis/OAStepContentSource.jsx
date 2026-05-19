import React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link2, Type, File } from 'lucide-react';

export default function OAStepContentSource({ data, onChange }) {
  const { name = '', description = '', inputType = 'url', objectUrl = '', textContent = '' } = data;

  const set = (patch) => onChange({ ...data, ...patch });

  return (
    <div className="rounded-xl border border-border/50 bg-card p-6 space-y-5">
      <div>
        <h2 className="text-sm font-semibold mb-0.5">Content Source</h2>
        <p className="text-xs text-muted-foreground">
          Give this analysis a name and choose how to provide the content to analyse.
        </p>
      </div>

      {/* Name & Description */}
      <div className="space-y-2">
        <Input
          value={name}
          onChange={e => set({ name: e.target.value })}
          placeholder="Analysis name *"
        />
        <Input
          value={description}
          onChange={e => set({ description: e.target.value })}
          placeholder="Description (optional)"
        />
      </div>

      {/* Input method */}
      <Tabs value={inputType} onValueChange={v => set({ inputType: v })}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="url" className="gap-2">
            <Link2 className="w-4 h-4" /> URL
          </TabsTrigger>
          <TabsTrigger value="text" className="gap-2">
            <Type className="w-4 h-4" /> Text
          </TabsTrigger>
          <TabsTrigger value="file" className="gap-2">
            <File className="w-4 h-4" /> File
          </TabsTrigger>
        </TabsList>

        <TabsContent value="url" className="mt-3">
          <Input
            value={objectUrl}
            onChange={e => set({ objectUrl: e.target.value })}
            placeholder="https://example.com/object.json"
          />
        </TabsContent>

        <TabsContent value="text" className="mt-3">
          <Textarea
            value={textContent}
            onChange={e => set({ textContent: e.target.value })}
            placeholder="Paste or type content to analyse..."
            className="min-h-[160px]"
          />
        </TabsContent>

        <TabsContent value="file" className="mt-3">
          <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-border/50 rounded-lg bg-muted/20">
            <File className="w-7 h-7 text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground text-center">
              File upload <span className="text-accent">coming soon</span>
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}