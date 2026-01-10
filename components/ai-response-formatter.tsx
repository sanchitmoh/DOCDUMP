'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  TrendingUp, BarChart3, PieChart, LineChart, Activity, 
  DollarSign, Calendar, Users, Target, AlertCircle, CheckCircle,
  ArrowUp, ArrowDown, Minus, Sparkles, Brain, Lightbulb
} from 'lucide-react';

interface AIResponseFormatterProps {
  content: string;
  insights?: string[];
  sources?: string[];
  metadata?: any;
}

export default function AIResponseFormatter({ 
  content, 
  insights = [], 
  sources = [], 
  metadata 
}: AIResponseFormatterProps) {
  
  // Parse content for better formatting
  const formatContent = (text: string) => {
    // Split content into paragraphs
    const paragraphs = text.split('\n\n').filter(p => p.trim());
    
    return paragraphs.map((paragraph, index) => {
      const lines = paragraph.split('\n').filter(line => line.trim());
      if (lines.length === 0) return null;
      
      // Check if this is a section with bullet points
      const hasBulletPoints = lines.some(line => 
        line.trim().startsWith('•') || 
        line.trim().startsWith('-') || 
        line.trim().match(/^\d+\./)
      );
      
      // Check if this looks like a title/header (short line followed by content)
      const isSection = lines.length > 1 && lines[0].length < 50 && lines[0].endsWith(':');
      
      if (isSection) {
        const title = lines[0].replace(':', '').trim();
        const content = lines.slice(1);
        
        return (
          <div key={index} className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              {getSectionIcon(title)}
              <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
            </div>
            
            <div className="pl-8 space-y-2">
              {content.map((line, lineIndex) => {
                if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
                  return (
                    <div key={lineIndex} className="flex items-start gap-3 py-1">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                      <p className="text-gray-700 leading-relaxed">{line.replace(/^[•\-]\s*/, '').trim()}</p>
                    </div>
                  );
                }
                
                if (line.trim().match(/^\d+\./)) {
                  const number = line.match(/^(\d+)\./)?.[1];
                  const text = line.replace(/^\d+\.\s*/, '').trim();
                  return (
                    <div key={lineIndex} className="flex items-start gap-3 py-1">
                      <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-medium text-blue-600">{number}</span>
                      </div>
                      <p className="text-gray-700 leading-relaxed">{text}</p>
                    </div>
                  );
                }
                
                return (
                  <p key={lineIndex} className="text-gray-700 leading-relaxed mb-2">
                    {line.trim()}
                  </p>
                );
              })}
            </div>
          </div>
        );
      }
      
      if (hasBulletPoints) {
        return (
          <div key={index} className="mb-6">
            <div className="space-y-2">
              {lines.map((line, lineIndex) => {
                if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
                  return (
                    <div key={lineIndex} className="flex items-start gap-3 py-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                      <p className="text-gray-700 leading-relaxed">{line.replace(/^[•\-]\s*/, '').trim()}</p>
                    </div>
                  );
                }
                
                if (line.trim().match(/^\d+\./)) {
                  const number = line.match(/^(\d+)\./)?.[1];
                  const text = line.replace(/^\d+\.\s*/, '').trim();
                  return (
                    <div key={lineIndex} className="flex items-start gap-3 py-1">
                      <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-medium text-green-600">{number}</span>
                      </div>
                      <p className="text-gray-700 leading-relaxed">{text}</p>
                    </div>
                  );
                }
                
                return (
                  <p key={lineIndex} className="text-gray-700 leading-relaxed mb-2 font-medium">
                    {line.trim()}
                  </p>
                );
              })}
            </div>
          </div>
        );
      }
      
      // Regular paragraph
      return (
        <div key={index} className="mb-4">
          {lines.map((line, lineIndex) => (
            <p key={lineIndex} className="text-gray-700 leading-relaxed mb-2">
              {line.trim()}
            </p>
          ))}
        </div>
      );
    });
  };

  const getSectionIcon = (title: string) => {
    const titleLower = title.toLowerCase();
    
    if (titleLower.includes('analysis') || titleLower.includes('structure')) {
      return <BarChart3 className="h-6 w-6 text-blue-600" />;
    }
    if (titleLower.includes('insight') || titleLower.includes('key')) {
      return <Lightbulb className="h-6 w-6 text-yellow-600" />;
    }
    if (titleLower.includes('visualization') || titleLower.includes('chart')) {
      return <PieChart className="h-6 w-6 text-green-600" />;
    }
    if (titleLower.includes('recommendation') || titleLower.includes('suggest')) {
      return <Target className="h-6 w-6 text-purple-600" />;
    }
    if (titleLower.includes('financial') || titleLower.includes('transaction')) {
      return <DollarSign className="h-6 w-6 text-emerald-600" />;
    }
    
    return <Sparkles className="h-6 w-6 text-indigo-600" />;
  };

  const formatInsights = () => {
    if (insights.length === 0) return null;
    
    return (
      <Card className="mt-6 border-l-4 border-l-blue-500 bg-blue-50/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Brain className="h-5 w-5 text-blue-600" />
            AI Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insights.map((insight, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-white rounded-lg shadow-sm">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mt-0.5">
                  <span className="text-xs font-medium text-blue-600">{index + 1}</span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{insight}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  const formatSources = () => {
    if (sources.length === 0) return null;
    
    return (
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="h-4 w-4 text-gray-600" />
          <span className="text-sm font-medium text-gray-700">Data Sources</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {sources.map((source, index) => (
            <Badge key={index} variant="outline" className="text-xs">
              {source}
            </Badge>
          ))}
        </div>
      </div>
    );
  };

  const formatMetadata = () => {
    if (!metadata) return null;
    
    return (
      <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-4">
          {metadata.hasVisualizations && (
            <div className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3 text-green-500" />
              <span>Charts Generated</span>
            </div>
          )}
          {metadata.sourcesUsed > 0 && (
            <div className="flex items-center gap-1">
              <Activity className="h-3 w-3 text-blue-500" />
              <span>{metadata.sourcesUsed} Source{metadata.sourcesUsed > 1 ? 's' : ''}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Badge 
              variant={metadata.confidenceLevel === 'high' ? 'default' : 'secondary'} 
              className="text-xs px-2 py-0.5"
            >
              {metadata.confidenceLevel} confidence
            </Badge>
          </div>
        </div>
        
        {metadata.model && (
          <div className="text-xs text-gray-400">
            Powered by {metadata.model}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Main Content */}
      <div className="prose prose-gray max-w-none">
        {content.includes('###') || content.includes(':') ? (
          <div className="space-y-6">
            {formatContent(content)}
          </div>
        ) : (
          <div className="space-y-4">
            {content.split('\n\n').map((paragraph, index) => {
              if (!paragraph.trim()) return null;
              
              // Check if paragraph has bullet points
              const lines = paragraph.split('\n').filter(line => line.trim());
              const hasBullets = lines.some(line => 
                line.trim().startsWith('•') || 
                line.trim().startsWith('-') || 
                line.trim().match(/^\d+\./)
              );
              
              if (hasBullets) {
                return (
                  <div key={index} className="space-y-2">
                    {lines.map((line, lineIndex) => {
                      if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
                        return (
                          <div key={lineIndex} className="flex items-start gap-3 py-1">
                            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                            <p className="text-gray-700 leading-relaxed">{line.replace(/^[•\-]\s*/, '').trim()}</p>
                          </div>
                        );
                      }
                      
                      if (line.trim().match(/^\d+\./)) {
                        const number = line.match(/^(\d+)\./)?.[1];
                        const text = line.replace(/^\d+\.\s*/, '').trim();
                        return (
                          <div key={lineIndex} className="flex items-start gap-3 py-1">
                            <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-medium text-blue-600">{number}</span>
                            </div>
                            <p className="text-gray-700 leading-relaxed">{text}</p>
                          </div>
                        );
                      }
                      
                      return (
                        <p key={lineIndex} className="text-gray-700 leading-relaxed font-medium">
                          {line.trim()}
                        </p>
                      );
                    })}
                  </div>
                );
              }
              
              return (
                <p key={index} className="text-gray-700 leading-relaxed text-base">
                  {paragraph.trim()}
                </p>
              );
            })}
          </div>
        )}
      </div>

      {/* Insights Section */}
      {formatInsights()}

      {/* Sources Section */}
      {formatSources()}

      {/* Metadata Section */}
      {formatMetadata()}
    </div>
  );
}