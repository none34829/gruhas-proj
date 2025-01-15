interface CategoryPattern {
  pattern: RegExp | string[];
  category: string;
  subCategory?: string;
  priority: number;
}

const CATEGORY_PATTERNS: CategoryPattern[] = [
  // Business Units - Highest Priority
  {
    pattern: ['ebo', 'mbo', 'lfs', 'fofo'],
    category: 'match_exact',  // Will use the matched term as category
    priority: 100
  },
  
  // Financial Documents
  {
    pattern: ['inventory', 'receivable', 'deposit', 'payment', 'invoice', 'balance sheet', 'p&l', 'profit', 'loss'],
    category: 'Financial',
    priority: 90
  },
  
  // Reports and Analysis
  {
    pattern: ['mis', 'report', 'analysis', 'summary', 'review', 'performance'],
    category: 'Reports',
    priority: 80
  },
  
  // Sales Data
  {
    pattern: ['sale', 'revenue', 'transaction', 'store wise', 'like to like', 'ltl', 'sssg'],
    category: 'Sales',
    priority: 70
  },
  
  // Store Metrics
  {
    pattern: ['count', 'metrics', 'kpi', 'statistics', 'footfall', 'conversion'],
    category: 'Metrics',
    priority: 60
  }
];

const SUB_CATEGORY_PATTERNS: CategoryPattern[] = [
  // Financial subcategories
  {
    pattern: ['inventory', 'receivable', 'stock'],
    category: 'Financial',
    subCategory: 'Assets',
    priority: 90
  },
  {
    pattern: ['deposit', 'payment'],
    category: 'Financial',
    subCategory: 'Transactions',
    priority: 90
  },
  
  // Sales subcategories
  {
    pattern: ['like to like', 'ltl', 'comparison'],
    category: 'Sales',
    subCategory: 'Comparisons',
    priority: 80
  },
  {
    pattern: ['store wise', 'storewise'],
    category: 'Sales',
    subCategory: 'Store-Performance',
    priority: 70
  },
  
  // Report subcategories
  {
    pattern: ['mis'],
    category: 'Reports',
    subCategory: 'MIS',
    priority: 90
  },
  {
    pattern: ['analysis', 'detailed'],
    category: 'Reports',
    subCategory: 'Analysis',
    priority: 80
  }
];

class FileCategorizer {
  private normalizeText(text: string): string {
    return text.toLowerCase().trim();
  }

  private findMatch(text: string, patterns: CategoryPattern[]): CategoryPattern | null {
    const normalizedText = this.normalizeText(text);
    const words = normalizedText.split(/[\s_-]+/);
    
    const sortedPatterns = [...patterns].sort((a, b) => b.priority - a.priority);
    
    for (const pattern of sortedPatterns) {
      if (Array.isArray(pattern.pattern)) {
        if (pattern.pattern.some(p => words.includes(p) || normalizedText.includes(p))) {
          return pattern;
        }
      } else if (pattern.pattern instanceof RegExp) {
        if (pattern.pattern.test(normalizedText)) {
          return pattern;
        }
      }
    }
    
    return null;
  }

  private extractDateFromFilename(filename: string): string {
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const normalizedText = this.normalizeText(filename);
    
    const patterns = [
      new RegExp(`(${months.join('|')})\\s*(20\\d{2}|\\d{2})`, 'i'),
      new RegExp(`(20\\d{2}|\\d{2})\\s*(${months.join('|')})`, 'i'),
      /(\d{2})[-_]*(20\d{2}|\d{2})/
    ];
    
    for (const pattern of patterns) {
      const match = normalizedText.match(pattern);
      if (match) {
        let month, year;
        
        if (months.includes(match[1].toLowerCase())) {
          month = match[1];
          year = match[2];
        } else {
          month = match[2];
          year = match[1];
        }
        
        year = year.length === 2 ? `20${year}` : year;
        month = month.charAt(0).toUpperCase() + month.toLowerCase().slice(1);
        
        return `${year}/${month}`;
      }
    }
    
    return 'No-Date';
  }

  public categorizeFile(filename: string): string {
    const datePath = this.extractDateFromFilename(filename);
    
    const mainCategoryMatch = this.findMatch(filename, CATEGORY_PATTERNS);
    const mainCategory = mainCategoryMatch 
      ? (mainCategoryMatch.category === 'match_exact' 
          ? this.findExactMatch(filename, mainCategoryMatch.pattern as string[]).toUpperCase()
          : mainCategoryMatch.category)
      : 'Other';
    
    const subCategoryMatch = this.findMatch(filename, SUB_CATEGORY_PATTERNS.filter(p => p.category === mainCategory));
    const subCategory = subCategoryMatch?.subCategory || 'General';
    
    return `${datePath}/${mainCategory}/${subCategory}`;
  }

  private findExactMatch(filename: string, patterns: string[]): string {
    const normalizedText = this.normalizeText(filename);
    const words = normalizedText.split(/[\s_-]+/);
    return patterns.find(p => words.includes(p)) || 'Other';
  }
}

export default FileCategorizer;
