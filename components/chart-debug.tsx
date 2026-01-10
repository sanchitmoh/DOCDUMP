'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ChartDebugProps {
  chart: any;
  index: number;
}

export default function ChartDebug({ chart, index }: ChartDebugProps) {
  return (
    <Card className="border-2 border-red-200 bg-red-50">
      <CardHeader>
        <CardTitle className="text-sm text-red-800">
          Debug Chart {index + 1}: {chart?.title || 'No Title'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-xs">
          <div>
            <strong>Type:</strong> {chart?.type || 'undefined'}
          </div>
          <div>
            <strong>Data Length:</strong> {chart?.data?.length || 0}
          </div>
          <div>
            <strong>Config:</strong> {JSON.stringify(chart?.config || {}, null, 2)}
          </div>
          <div>
            <strong>Sample Data:</strong>
            <pre className="bg-white p-2 rounded text-xs overflow-auto max-h-32">
              {JSON.stringify(chart?.data?.slice(0, 3) || [], null, 2)}
            </pre>
          </div>
          <div>
            <strong>Full Chart Object:</strong>
            <pre className="bg-white p-2 rounded text-xs overflow-auto max-h-40">
              {JSON.stringify(chart || {}, null, 2)}
            </pre>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}