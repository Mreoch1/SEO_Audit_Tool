'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { Trash2, Plus } from 'lucide-react'

interface ScheduledAudit {
  id: string
  url: string
  cronExpression: string
  lastRunAt: string | null
  nextRun: string
  emailTo: string | null
  active: boolean
}

export default function ScheduledAuditsPage() {
  const { toast } = useToast()
  const [audits, setAudits] = useState<ScheduledAudit[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    url: '',
    cronExpression: '0 0 * * *', // Daily at midnight
    emailTo: '',
    active: true
  })

  useEffect(() => {
    fetchAudits()
  }, [])

  const fetchAudits = async () => {
    try {
      const res = await fetch('/api/scheduled-audits')
      const data = await res.json()
      setAudits(data)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load scheduled audits',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/scheduled-audits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!res.ok) throw new Error('Failed to create scheduled audit')

      toast({
        title: 'Success',
        description: 'Scheduled audit created'
      })
      setShowForm(false)
      setFormData({
        url: '',
        cronExpression: '0 0 * * *',
        emailTo: '',
        active: true
      })
      fetchAudits()
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create scheduled audit',
        variant: 'destructive'
      })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this scheduled audit?')) return

    try {
      const res = await fetch(`/api/scheduled-audits/${id}`, {
        method: 'DELETE'
      })

      if (!res.ok) throw new Error('Failed to delete')

      toast({
        title: 'Success',
        description: 'Scheduled audit deleted'
      })
      fetchAudits()
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete scheduled audit',
        variant: 'destructive'
      })
    }
  }

  const handleToggleActive = async (id: string, active: boolean) => {
    try {
      const res = await fetch(`/api/scheduled-audits/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !active })
      })

      if (!res.ok) throw new Error('Failed to update')

      fetchAudits()
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update scheduled audit',
        variant: 'destructive'
      })
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <Link href="/audits/new" className="text-blue-600 hover:underline">← Create New Audit</Link>
            <h1 className="text-2xl font-bold mt-2">Scheduled Audits</h1>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="mr-2 h-4 w-4" />
            New Scheduled Audit
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {showForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Create Scheduled Audit</CardTitle>
              <CardDescription>
                Set up recurring SEO audits. Use cron expressions for scheduling.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="url">Website URL</Label>
                  <Input
                    id="url"
                    type="url"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    required
                    placeholder="https://example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cronExpression">Cron Expression</Label>
                  <Input
                    id="cronExpression"
                    value={formData.cronExpression}
                    onChange={(e) => setFormData({ ...formData, cronExpression: e.target.value })}
                    required
                    placeholder="0 0 * * *"
                  />
                  <p className="text-xs text-gray-500">
                    Examples: "0 0 * * *" (daily), "0 0 * * 0" (weekly), "0 0 1 * *" (monthly)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emailTo">Email To (Optional)</Label>
                  <Input
                    id="emailTo"
                    type="email"
                    value={formData.emailTo}
                    onChange={(e) => setFormData({ ...formData, emailTo: e.target.value })}
                    placeholder="client@example.com"
                  />
                  <p className="text-xs text-gray-500">
                    If provided, PDF report will be automatically emailed after each audit
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button type="submit">Create</Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : audits.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-600 mb-4">No scheduled audits yet</p>
              <Button onClick={() => setShowForm(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Scheduled Audit
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {audits.map((audit) => (
              <Card key={audit.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle>{audit.url}</CardTitle>
                      <CardDescription className="mt-2">
                        <div>Cron: {audit.cronExpression}</div>
                        <div>Next Run: {new Date(audit.nextRun).toLocaleString()}</div>
                        {audit.lastRunAt && (
                          <div>Last Run: {new Date(audit.lastRunAt).toLocaleString()}</div>
                        )}
                        {audit.emailTo && <div>Email: {audit.emailTo}</div>}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant={audit.active ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleToggleActive(audit.id, audit.active)}
                      >
                        {audit.active ? 'Active' : 'Inactive'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(audit.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

