'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart } from 'lucide-react';

export default function DataPage() {
  return (
    <div className="p-4 md:p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <LineChart className="h-8 w-8 text-primary" />
          Data Hub
        </h1>
        <p className="text-muted-foreground">
          Analyze scraped data to build your betting edge.
        </p>
      </header>
      <div className="grid gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Coming Soon</CardTitle>
            <CardDescription>
              This section will be used to display scraped data from various sources and allow you to create custom formulas and models.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>The infrastructure for data scraping and analysis is being set up.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
