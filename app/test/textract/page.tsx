import { TextractTest } from '@/components/textract-test'

export default function TextractTestPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">AWS Textract Integration Test</h1>
          <p className="text-muted-foreground mt-2">
            Test AWS Textract document extraction and analysis capabilities
          </p>
        </div>
        
        <TextractTest />
      </div>
    </div>
  )
}

export const metadata = {
  title: 'AWS Textract Test',
  description: 'Test AWS Textract integration for document processing',
}