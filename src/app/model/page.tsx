'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BrainCircuit } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function ModelPage() {
  return (
    <div className="p-4 md:p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <BrainCircuit className="h-8 w-8 text-primary" />
          Our Predictive Model
        </h1>
        <p className="text-muted-foreground">
          Analyzing NBA games with our custom power ratings system.
        </p>
      </header>

      <div className="grid gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Today's Predictions</CardTitle>
            <CardDescription>
              Model predictions for upcoming NBA games. Visualizations and detailed analysis are coming soon.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </CardContent>
        </Card>
         <Card>
          <CardHeader>
            <CardTitle>Model Performance</CardTitle>
            <CardDescription>
              Tracking the accuracy of our model's predictions over time.
            </CardDescription>
          </CardHeader>
          <CardContent>
             <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}