'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  TrendingUp, TrendingDown, BarChart3, PieChart as PieChartIcon, 
  LineChart as LineChartIcon, Activity, Brain, Target, AlertTriangle,
  CheckCircle, Info, Lightbulb, Download, Share2
} from 'lucide-react';

interface ChartData {
  type: 'bar' | 'line' | 'pie' | 'scatter' | 'histogram';
  title: string;
  description: string;
  data: any[];
  config: any;
  insights?: string[];
  dataQuality?: { score: number; issues: string[] };
  interactionSuggestions?: string[];
}

interface AnalysisData {
  summary: {
    totalRecords: number;
    columns: string[];
    dataTypes: { [key: string]: string };
  };
  statistics: any;
  insights: string[];
  recommendations: string[];
  chartSuggestions: ChartData[];
}

interface AdvancedDataVisualizationProps {
  fileId: number;
  fileName: string;
  onAnalysisComplete?: (data: any) => void;
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00', '#ff00ff'];

export default function AdvancedDataVisualization({ 
  fileId, 
  fileName, 
  onAnalysisComplete 
}: AdvancedDataVisualizationProps) {
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [chartsData, setChartsData] = useState<any>(null);
  const [insightsData, setInsightsData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  const performAnalysis = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Perform comprehensive analysis
      const analysisResponse = await fetch('/api/analyze-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId, analysisType: 'comprehensive' })
      });
      
      if (!analysisResponse.ok) {
        throw new Error('Analysis failed');
      }
      
      const analysisResult = await analysisResponse.json();
      setAnalysisData(analysisResult.data.analysis);
      
      // Generate charts
      const chartsResponse = await fetch('/api/generate-charts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId, chartTypes: ['bar', 'line', 'pie', 'scatter'] })
      });
      
      if (chartsResponse.ok) {
        const chartsResult = await chartsResponse.json();
        setChartsData(chartsResult.data);
      }
      
      // Generate AI insights
      const insightsResponse = await fetch('/api/data-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId, insightType: 'comprehensive' })
      });
      
      if (insightsResponse.ok) {
        const insightsResult = await insightsResponse.json();
        setInsightsData(insightsResult.data);
      }
      
      onAnalysisComplete?.(analysisResult.data);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const renderChart = (chart: ChartData, index: number) => {
    const chartProps = {
      width: '100%',
      height: 300,
      data: chart.data,
      margin: { top: 5, right: 30, left: 20, bottom: 5 }
    };

    switch (chart.type) {
      case 'bar':
        return (
          <ResponsiveContainer {...chartProps}>
            <BarChart data={chart.data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={chart.config.xAxis || 'name'} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar 
                dataKey={chart.config.yAxis || 'value'} 
                fill={COLORS[index % COLORS.length]} 
              />
            </BarChart>
          </ResponsiveContainer>
        );
        
      case 'line':
        return (
          <ResponsiveContainer {...chartProps}>
            <LineChart data={chart.data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={chart.config.xAxis || 'name'} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey={chart.config.yAxis || 'value'} 
                stroke={COLORS[index % COLORS.length]} 
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        );
        
      case 'pie':
        return (
          <ResponsiveContainer {...chartProps}>
            <PieChart>
              <Pie
                data={chart.data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {chart.data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        );
        
      case 'scatter':
        return (
          <ResponsiveContainer {...chartProps}>
            <ScatterChart data={chart.data}>
              <CartesianGrid />
              <XAxis dataKey="x" />
              <YAxis dataKey="y" />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <Scatter fill={COLORS[index % COLORS.length]} />
            </ScatterChart>
          </ResponsiveContainer>
        );
        
      default:
        return <div className="text-center text-gray-500">Chart type not supported</div>;
    }
  };

  const getChartIcon = (type: string) => {
    switch (type) {
      case 'bar': return <BarChart3 className="h-4 w-4" />;
      case 'line': return <LineChartIcon className="h-4 w-4" />;
      case 'pie': return <PieChartIcon className="h-4 w-4" />;
      case 'scatter': return <Activity className="h-4 w-4" />;
      default: return <BarChart3 className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Advanced Data Analysis</h2>
          <p className="text-gray-600">Comprehensive analysis of {fileName}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={performAnalysis} disabled={loading}>
            {loading ? 'Analyzing...' : 'Start Analysis'}
          </Button>
          {analysisData && (
            <>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" size="sm">
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {loading && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5 animate-pulse" />
                <span>Analyzing data...</span>
              </div>
              <Progress value={33} className="w-full" />
              <p className="text-sm text-gray-600">
                Processing {fileName} for comprehensive insights
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {analysisData && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="charts">Visualizations</TabsTrigger>
            <TabsTrigger value="insights">AI Insights</TabsTrigger>
            <TabsTrigger value="recommendations">Actions</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Records</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {analysisData.summary.totalRecords.toLocaleString()}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Data Columns</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analysisData.summary.columns.length}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Chart Suggestions</CardTitle>
                  <PieChartIcon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analysisData.chartSuggestions.length}</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Data Summary</CardTitle>
                <CardDescription>Overview of your dataset structure</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Columns ({analysisData.summary.columns.length})</h4>
                    <div className="flex flex-wrap gap-2">
                      {analysisData.summary.columns.map((column, index) => (
                        <Badge key={index} variant="secondary">
                          {column}
                          <span className="ml-1 text-xs">
                            ({analysisData.summary.dataTypes[column] || 'unknown'})
                          </span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Key Insights</h4>
                    <ul className="space-y-1">
                      {analysisData.insights.slice(0, 5).map((insight, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                          {insight}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="charts" className="space-y-4">
            {chartsData?.charts ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {chartsData.charts.map((chart: ChartData, index: number) => (
                  <Card key={index}>
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        {getChartIcon(chart.type)}
                        <CardTitle className="text-lg">{chart.title}</CardTitle>
                      </div>
                      <CardDescription>{chart.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="mb-4">
                        {renderChart(chart, index)}
                      </div>
                      
                      {chart.insights && chart.insights.length > 0 && (
                        <div className="space-y-2">
                          <h5 className="font-medium text-sm">Key Insights:</h5>
                          <ul className="space-y-1">
                            {chart.insights.map((insight, i) => (
                              <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                                <Info className="h-3 w-3 mt-1 flex-shrink-0" />
                                {insight}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {chart.dataQuality && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">Data Quality</span>
                            <Badge variant={chart.dataQuality.score > 80 ? 'default' : 'secondary'}>
                              {chart.dataQuality.score}%
                            </Badge>
                          </div>
                          <Progress value={chart.dataQuality.score} className="h-2" />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-gray-500">No charts available. Run analysis first.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="insights" className="space-y-4">
            {insightsData?.insights ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="h-5 w-5" />
                      AI Business Insights
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {insightsData.insights.ai?.businessInsights?.map((insight: string, index: number) => (
                        <li key={index} className="flex items-start gap-2">
                          <Lightbulb className="h-4 w-4 text-yellow-500 mt-1 flex-shrink-0" />
                          <span className="text-sm">{insight}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Opportunities
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {insightsData.insights.ai?.opportunities?.map((opportunity: string, index: number) => (
                        <li key={index} className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                          <span className="text-sm">{opportunity}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      Risks & Concerns
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {insightsData.insights.ai?.risks?.map((risk: string, index: number) => (
                        <li key={index} className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-red-500 mt-1 flex-shrink-0" />
                          <span className="text-sm">{risk}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      Key Questions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {insightsData.insights.ai?.questions?.map((question: string, index: number) => (
                        <li key={index} className="flex items-start gap-2">
                          <Info className="h-4 w-4 text-blue-500 mt-1 flex-shrink-0" />
                          <span className="text-sm">{question}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-gray-500">No AI insights available. Run analysis first.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="recommendations" className="space-y-4">
            {insightsData?.insights?.actionable ? (
              <div className="space-y-4">
                {insightsData.insights.actionable.map((rec: any, index: number) => (
                  <Card key={index}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{rec.action}</CardTitle>
                        <Badge variant={rec.priority === 'high' ? 'destructive' : rec.priority === 'medium' ? 'default' : 'secondary'}>
                          {rec.priority} priority
                        </Badge>
                      </div>
                      <CardDescription>{rec.category}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <p className="text-sm"><strong>Reason:</strong> {rec.reason}</p>
                        <p className="text-sm"><strong>Expected Impact:</strong> {rec.impact}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-gray-500">No recommendations available. Run analysis first.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}