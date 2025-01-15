import * as XLSX from 'xlsx';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

interface FinancialMetrics {
  revenue?: number[];
  profit?: number[];
  margins?: number[];
  periods?: string[];
  [key: string]: number[] | string[] | undefined;
}

export class FinancialAnalyzer {
  private static readonly SUPPORTED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

  // Extract data from Excel files
  static async extractData(buffer: Buffer): Promise<FinancialMetrics> {
    try {
      console.log('Starting data extraction...');
      const workbook = XLSX.read(buffer);
      console.log('Workbook read successfully, sheets:', workbook.SheetNames);
      
      const metrics: FinancialMetrics = {};
      
      for (const sheetName of workbook.SheetNames) {
        console.log(`Processing sheet: ${sheetName}`);
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
        console.log(`Converted sheet to JSON, rows: ${jsonData.length}`);
        
        if (jsonData.length === 0) {
          console.log(`Sheet ${sheetName} is empty, skipping`);
          continue;
        }
        
        // Try to identify columns based on common headers
        const headerRow = jsonData[0];
        if (!Array.isArray(headerRow)) {
          console.log(`Invalid header row in sheet ${sheetName}, skipping`);
          continue;
        }
        
        console.log('Headers found:', headerRow);
        
        const columnIndices = this.identifyColumns(headerRow);
        console.log('Identified columns:', columnIndices);
        
        if (Object.keys(columnIndices).length > 0) {
          // Extract data based on identified columns
          const data = jsonData.slice(1).filter((row): row is string[] => 
            Array.isArray(row) && row.length > 0
          );
          console.log(`Processing ${data.length} data rows`);
          this.extractMetrics(data, columnIndices, metrics);
        } else {
          console.log('No relevant columns identified in this sheet');
        }
      }
      
      console.log('Extraction completed. Metrics:', metrics);
      return metrics;
    } catch (error) {
      console.error('Error in extractData:', error);
      throw new Error(`Failed to extract data from Excel: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Identify relevant columns from headers
  private static identifyColumns(headers: string[]): { [key: string]: number } {
    const columnIndices: { [key: string]: number } = {};
    const patterns = {
      revenue: /(revenue|sales|income|turnover)/i,
      profit: /(profit|earnings|ebitda|net income)/i,
      period: /(period|date|month|quarter|year)/i,
      margins: /(margin|profit %|markup)/i
    };

    headers.forEach((header, index) => {
      if (typeof header === 'string') {
        for (const [key, pattern] of Object.entries(patterns)) {
          if (pattern.test(header)) {
            columnIndices[key] = index;
          }
        }
      }
    });

    return columnIndices;
  }

  // Extract metrics from identified columns
  private static extractMetrics(
    data: string[][],
    columnIndices: { [key: string]: number },
    metrics: FinancialMetrics
  ): void {
    if (columnIndices.period) {
      metrics.periods = data.map(row => row[columnIndices.period]?.toString() || '');
    }
    if (columnIndices.revenue) {
      metrics.revenue = data.map(row => this.parseNumber(row[columnIndices.revenue]));
    }
    if (columnIndices.profit) {
      metrics.profit = data.map(row => this.parseNumber(row[columnIndices.profit]));
    }
    if (columnIndices.margins) {
      metrics.margins = data.map(row => this.parseNumber(row[columnIndices.margins]));
    }
  }

  // Helper to parse numbers from various formats
  private static parseNumber(value: unknown): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      // Remove currency symbols and commas, convert percentages
      const cleaned = value.replace(/[₹,$,\s]/g, '');
      if (cleaned.endsWith('%')) {
        return parseFloat(cleaned) / 100;
      }
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  // Analyze financial data using GPT-4
  static async analyzeData(metrics: FinancialMetrics, query: string): Promise<string> {
    try {
      console.log('Preparing analysis with metrics:', metrics);
      
      if (!metrics || Object.keys(metrics).length === 0) {
        throw new Error('No financial metrics found to analyze');
      }

      const context = this.prepareAnalysisContext(metrics);
      console.log('Prepared context:', context);
      
      if (!context) {
        throw new Error('Could not prepare analysis context from the data');
      }

      const systemPrompt = `You are a financial analyst expert. Analyze the following financial data and provide insights.
Focus on:
- Revenue trends and growth rates
- Profit margins and their changes
- Key performance indicators
- Notable patterns or anomalies
- Business insights and recommendations

Provide specific numbers and percentages when relevant. Be concise but thorough.
If the data doesn't contain certain metrics, focus on the available information.`;

      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OpenAI API key is not configured');
      }

      console.log('Sending request to OpenAI...');
      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Here is the financial data:\n\n${context}\n\nAnalyze this data and answer: ${query}` }
        ],
        temperature: 0.3,
        max_tokens: 1000
      });

      console.log('Received response from OpenAI');
      const analysis = response.choices[0].message.content;
      
      if (!analysis) {
        throw new Error('No analysis received from OpenAI');
      }

      return analysis;
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error(`Failed to analyze the financial data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Prepare context for GPT analysis
  private static prepareAnalysisContext(metrics: FinancialMetrics): string {
    console.log('Preparing analysis context from metrics:', metrics);
    let context = '';
    
    if (!metrics.periods || metrics.periods.length === 0) {
      console.log('No period data found');
      return 'No time period information found in the data.';
    }

    // Add headers explanation if present
    context += 'Financial Data Analysis:\n\n';
    
    if (metrics.periods && metrics.periods.length > 0) {
      context += 'Time Periods:\n';
      context += metrics.periods.join(', ') + '\n\n';
    }

    if (metrics.revenue && metrics.revenue.length > 0) {
      context += 'Revenue Data:\n';
      metrics.periods.forEach((period, i) => {
        if (metrics.revenue && metrics.revenue[i] !== undefined) {
          context += `${period}: ${this.formatCurrency(metrics.revenue[i])}\n`;
        }
      });
      context += '\n';
    }

    if (metrics.profit && metrics.profit.length > 0) {
      context += 'Profit Data:\n';
      metrics.periods.forEach((period, i) => {
        if (metrics.profit && metrics.profit[i] !== undefined) {
          context += `${period}: ${this.formatCurrency(metrics.profit[i])}\n`;
        }
      });
      context += '\n';
    }

    if (metrics.margins && metrics.margins.length > 0) {
      context += 'Profit Margins:\n';
      metrics.periods.forEach((period, i) => {
        if (metrics.margins && metrics.margins[i] !== undefined) {
          context += `${period}: ${(metrics.margins[i] * 100).toFixed(2)}%\n`;
        }
      });
      context += '\n';
    }

    console.log('Prepared context:', context);
    return context;
  }

  // Format currency values
  private static formatCurrency(value: number): string {
    if (value >= 10000000) {
      return `₹${(value / 10000000).toFixed(2)} Cr`;
    } else if (value >= 100000) {
      return `₹${(value / 100000).toFixed(2)} L`;
    }
    return `₹${value.toFixed(2)}`;
  }
}
