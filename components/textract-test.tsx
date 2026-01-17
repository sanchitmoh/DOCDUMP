'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2, FileText, Table, FormInput, CheckCircle, XCircle } from 'lucide-react'

interface TextractResult {
  success: boolean
  method: string
  data?: {
    text: string
    textLength: number
    confidence: number
    metadata: any
    tables?: number
    forms?: number
    structuredData?: {
      tables: any[]
      forms: any[]
    }
  }
  error?: string
  troubleshooting?: string[]
  awsConfig?: {
    region: string
    hasAccessKey: boolean
    hasSecretKey: boolean
    bucket: string
  }
}

export function TextractTest() {
  const [filePath, setFilePath] = useState('./test-document.pdf')
  const [useAnalysis, setUseAnalysis] = useState(false)
  const [method, setMethod] = useState('auto')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TextractResult | null>(null)

  const testTextract = async () => {
    setLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/test/textract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filePath,
          useAnalysis,
          method
        }),
      })

      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({
        success: false,
        method: 'unknown',
        error: error instanceof Error ? error.message : 'Network error'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            AWS Textract Test
          </CardTitle>
          <CardDescription>
            Test AWS Textract integration for document text extraction and analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">File Path</label>
              <Input
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                placeholder="./test-document.pdf"
              />
              <p className="text-xs text-muted-foreground">
                Supported: PDF, PNG, JPG, JPEG, TIFF
              </p>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full p-2 border rounded-md"
              >
                <option value="auto">Auto (Extraction Service)</option>
                <option value="direct">Direct (Textract Service)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="analysis"
              checked={useAnalysis}
              onCheckedChange={(checked) => setUseAnalysis(checked as boolean)}
            />
            <label htmlFor="analysis" className="text-sm font-medium">
              Enable document analysis (extract tables and forms)
            </label>
          </div>

          <Button 
            onClick={testTextract} 
            disabled={loading || !filePath}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              'Test Textract'
            )}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              Test Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.success && result.data ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {result.data.textLength.toLocaleString()}
                    </div>
                    <div className="text-sm text-muted-foreground">Characters</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {result.data.confidence}%
                    </div>
                    <div className="text-sm text-muted-foreground">Confidence</div>
                  </div>
                  {result.data.tables !== undefined && (
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {result.data.tables}
                      </div>
                      <div className="text-sm text-muted-foreground">Tables</div>
                    </div>
                  )}
                  {result.data.forms !== undefined && (
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {result.data.forms}
                      </div>
                      <div className="text-sm text-muted-foreground">Forms</div>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    Method: {result.method}
                  </Badge>
                  <Badge variant="outline">
                    Processing: {result.data.metadata.method}
                  </Badge>
                  <Badge variant="outline">
                    Time: {result.data.metadata.processing_time_ms}ms
                  </Badge>
                  <Badge variant="outline">
                    Pages: {result.data.metadata.pages}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">Extracted Text Preview:</h4>
                  <div className="p-3 bg-muted rounded-md text-sm font-mono">
                    {result.data.text}
                  </div>
                </div>

                {result.data.structuredData && (
                  <div className="space-y-4">
                    {result.data.structuredData.tables.length > 0 && (
                      <div>
                        <h4 className="font-medium flex items-center gap-2 mb-2">
                          <Table className="h-4 w-4" />
                          Tables Found
                        </h4>
                        {result.data.structuredData.tables.map((table: any, index: number) => (
                          <div key={index} className="border rounded-md p-3 mb-2">
                            <div className="text-sm text-muted-foreground mb-2">
                              Table {index + 1} - {table.rows.length} rows, {table.rows[0]?.length || 0} columns
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm border-collapse">
                                <tbody>
                                  {table.rows.slice(0, 3).map((row: string[], rowIndex: number) => (
                                    <tr key={rowIndex}>
                                      {row.map((cell: string, cellIndex: number) => (
                                        <td key={cellIndex} className="border p-1 text-xs">
                                          {cell}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {table.rows.length > 3 && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  ... and {table.rows.length - 3} more rows
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {result.data.structuredData.forms.length > 0 && (
                      <div>
                        <h4 className="font-medium flex items-center gap-2 mb-2">
                          <FormInput className="h-4 w-4" />
                          Form Fields Found
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {result.data.structuredData.forms.map((form: any, index: number) => (
                            <div key={index} className="border rounded-md p-2">
                              <div className="text-sm font-medium">{form.key}</div>
                              <div className="text-sm text-muted-foreground">{form.value}</div>
                              <div className="text-xs text-muted-foreground">
                                {Math.round(form.confidence)}% confidence
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-4">
                <Alert>
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Error:</strong> {result.error}
                  </AlertDescription>
                </Alert>

                {result.troubleshooting && result.troubleshooting.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Troubleshooting:</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      {result.troubleshooting.map((tip, index) => (
                        <li key={index}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.awsConfig && (
                  <div>
                    <h4 className="font-medium mb-2">AWS Configuration:</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>Region: {result.awsConfig.region}</div>
                      <div>Bucket: {result.awsConfig.bucket}</div>
                      <div>Access Key: {result.awsConfig.hasAccessKey ? '✅' : '❌'}</div>
                      <div>Secret Key: {result.awsConfig.hasSecretKey ? '✅' : '❌'}</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Quick Start</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>1. Place a test document (PDF, PNG, JPG) in your project root</p>
          <p>2. Update the file path above to match your test file</p>
          <p>3. Choose whether to enable document analysis for tables/forms</p>
          <p>4. Click "Test Textract" to process the document</p>
          <p className="text-muted-foreground">
            Make sure your AWS credentials are configured in .env.local
          </p>
        </CardContent>
      </Card>
    </div>
  )
}