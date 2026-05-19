import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { X, Plus, Link2 } from 'lucide-react';

export default function VocabularyLinkEditor({ open, onClose, vocabularySources, existingLinks, onSave }) {
  const [formData, setFormData] = useState({
    vocabulary_source_id: '',
    target_entity: 'Policy',
    target_field: '',
    display_label: '',
    is_required: false,
    allow_multiple: false,
    sort_order: 0,
    is_active: true,
    notes: '',
  });

  const handleSubmit = () => {
    if (!formData.vocabulary_source_id || !formData.target_field) {
      return;
    }
    onSave(formData);
    onClose();
  };

  const targetEntities = ['Policy', 'Action', 'Constraint', 'Agent', 'Resource', 'User'];
  
  const commonFields = {
    Policy: ['status', 'odrl_type', 'type', 'lang', 'permissions.action', 'prohibitions.action', 'duties.action'],
    Action: ['type', 'status', 'odrl_mapping'],
    Constraint: ['type', 'status', 'constraint_type'],
    Agent: ['type', 'role', 'status'],
    Resource: ['type', 'status', 'license'],
    User: ['role', 'status', 'institution_type'],
  };

  const availableFields = commonFields[formData.target_entity] || [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-4 h-4" />
            Link Vocabulary to Form Field
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Connect a controlled vocabulary to a specific form field for consistent data entry.
          </p>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="vocabulary_source_id">Vocabulary Source *</Label>
            <Select
              value={formData.vocabulary_source_id}
              onValueChange={(value) => setFormData({ ...formData, vocabulary_source_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a vocabulary source..." />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {vocabularySources.map((vocab) => (
                  <SelectItem key={vocab.id} value={vocab.id}>
                    {vocab.name}
                    {vocab.description && <span className="ml-1.5 text-muted-foreground text-xs">({vocab.description})</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="target_entity">Target Entity *</Label>
              <Select
                value={formData.target_entity}
                onValueChange={(value) => setFormData({ ...formData, target_entity: value, target_field: '' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Policy">Policy</SelectItem>
                  <SelectItem value="Action">Action</SelectItem>
                  <SelectItem value="Constraint">Constraint</SelectItem>
                  <SelectItem value="Agent">Agent</SelectItem>
                  <SelectItem value="Resource">Resource</SelectItem>
                  <SelectItem value="User">User</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="target_field">Target Field *</Label>
              <Select
                value={formData.target_field}
                onValueChange={(value) => setFormData({ ...formData, target_field: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select field..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {availableFields.map((field) => (
                    <SelectItem key={field} value={field}>
                      {field}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="display_label">Display Label</Label>
            <Input
              id="display_label"
              value={formData.display_label}
              onChange={(e) => setFormData({ ...formData, display_label: e.target.value })}
              placeholder="e.g., Policy Status, Action Type"
            />
            <p className="text-xs text-muted-foreground">
              This label will appear in forms when selecting values from this vocabulary.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="is_required"
                checked={formData.is_required}
                onCheckedChange={(checked) => setFormData({ ...formData, is_required: checked })}
              />
              <Label htmlFor="is_required">Required Field</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="allow_multiple"
                checked={formData.allow_multiple}
                onCheckedChange={(checked) => setFormData({ ...formData, allow_multiple: checked })}
              />
              <Label htmlFor="allow_multiple">Allow Multiple Selection</Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sort_order">Display Order</Label>
            <Input
              id="sort_order"
              type="number"
              value={formData.sort_order}
              onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
            <Label htmlFor="is_active">Active</Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional context about this vocabulary usage..."
              className="h-20"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            <X className="w-3.5 h-3.5 mr-1" /> Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Create Link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}