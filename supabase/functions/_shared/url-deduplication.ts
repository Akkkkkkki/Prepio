// URL Deduplication and Content Management System (OPTIMIZED)
// Handles intelligent URL reuse and content caching for research optimization
// Updated to work with consolidated scraped_urls table

export interface ScrapedUrl {
  id?: string;
  url: string;
  domain: string;
  url_hash: string;
  company_name: string;
  role_title?: string;
  country?: string;
  title?: string;
  content_summary?: string;
  content_type: 'interview_review' | 'company_info' | 'job_posting' | 'news' | 'other';
  content_quality_score: number;
  extraction_method: 'search_result' | 'deep_extract' | 'manual';
  times_reused: number;
  first_scraped_at: string;
  last_reused_at?: string;
  
  // New consolidated content fields
  full_content?: string;
  raw_html?: string;
  structured_data?: any;
  extracted_questions?: string[];
  extracted_insights?: string[];
  word_count?: number;
  language?: string;
  content_source?: string;
  processing_status?: 'raw' | 'processed' | 'analyzed' | 'failed';
  ai_summary?: string;
}

export interface UrlDeduplicationResult {
  reusable_urls: string[];
  excluded_domains: string[];
  total_cached_urls: number;
}

// URL and Content Management Class
export class UrlDeduplicationService {
  constructor(private supabase: any) {}

  // Store a scraped URL with content (consolidated)
  async storeScrapedUrl(
    url: string,
    company: string,
    role?: string,
    country?: string,
    metadata: {
      title?: string;
      content_summary?: string;
      content_type: ScrapedUrl['content_type'];
      quality_score: number;
      extraction_method: ScrapedUrl['extraction_method'];
      full_content?: string;
      ai_summary?: string;
      structured_data?: any;
      extracted_questions?: string[];
      extracted_insights?: string[];
      content_source?: string;
    }
  ): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .schema('ops')
        .from('scraped_urls')
        .insert({
          url,
          company_name: company,
          role_title: role,
          country: country,
          title: metadata.title,
          content_summary: metadata.content_summary,
          content_type: metadata.content_type,
          content_quality_score: metadata.quality_score,
          extraction_method: metadata.extraction_method,
          times_reused: 0,
          // Consolidated content fields
          full_content: metadata.full_content,
          ai_summary: metadata.ai_summary,
          structured_data: metadata.structured_data || {},
          extracted_questions: metadata.extracted_questions || [],
          extracted_insights: metadata.extracted_insights || [],
          content_source: metadata.content_source || 'tavily_search',
          processing_status: 'raw',
          language: 'en'
        })
        .select('id')
        .single();

      if (error) {
        // Handle duplicate URL case
        if (error.code === '23505') {
          console.log(`URL already exists: ${url}`);
          return null;
        }
        throw error;
      }

      return data.id;
    } catch (error) {
      console.error('Error storing scraped URL:', error);
      return null;
    }
  }

  // Update existing URL with content
  async updateScrapedUrlContent(
    urlId: string,
    content: {
      full_content: string;
      raw_html?: string;
      structured_data?: any;
      extracted_questions?: string[];
      extracted_insights?: string[];
      content_source: string;
      ai_summary?: string;
    }
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .schema('ops')
        .from('scraped_urls')
        .update({
          full_content: content.full_content,
          raw_html: content.raw_html,
          structured_data: content.structured_data,
          extracted_questions: content.extracted_questions,
          extracted_insights: content.extracted_insights,
          content_source: content.content_source,
          ai_summary: content.ai_summary,
          processing_status: 'processed',
          word_count: content.full_content.split(/\s+/).length
        })
        .eq('id', urlId);

      return !error;
    } catch (error) {
      console.error('Error updating scraped URL content:', error);
      return false;
    }
  }

  // Find reusable URLs using simplified function
  async findReusableUrls(
    company: string,
    role?: string,
    country?: string,
    options: {
      maxAgeDays?: number;
      minQualityScore?: number;
      limit?: number;
    } = {}
  ): Promise<UrlDeduplicationResult> {
    const { maxAgeDays = 30, minQualityScore = 0.3, limit = 20 } = options;
    const startTime = Date.now();

    try {
      // Use the new simplified function
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout')), 5000)
      );

      const urlsPromise = this.supabase.schema('ops').rpc('find_reusable_urls_simple', {
        p_company_name: company,
        p_role_title: role,
        p_max_age_days: maxAgeDays,
        p_min_quality_score: minQualityScore
      });

      const { data: reusableUrls, error: urlsError } = await Promise.race([
        urlsPromise,
        timeoutPromise
      ]);

      if (urlsError) {
        console.warn('URL deduplication failed, using fallback:', urlsError.message);
        return {
          reusable_urls: [],
          excluded_domains: [],
          total_cached_urls: 0
        };
      }

      const responseTime = Date.now() - startTime;
      const urls = reusableUrls?.map((item: any) => item.url)?.slice(0, limit) || [];
      
      // Log performance metrics
      console.log(`URL deduplication completed in ${responseTime}ms, found ${urls.length} reusable URLs`);

      return {
        reusable_urls: urls,
        excluded_domains: [], // Simplified for performance
        total_cached_urls: urls.length
      };
    } catch (error) {
      console.warn('URL deduplication failed, using fallback:', error.message);
      return {
        reusable_urls: [],
        excluded_domains: [],
        total_cached_urls: 0
      };
    }
  }

  // Get content for previously scraped URLs (simplified)
  async getExistingContent(
    urls: string[],
    company: string,
    role?: string,
    country?: string
  ): Promise<Array<{ url: string; content: string; title: string; ai_summary?: string }>> {
    try {
      // Add safeguards to prevent infinite calls
      if (!urls || urls.length === 0) {
        return [];
      }
      
      // Limit to prevent excessive queries
      const limitedUrls = urls.slice(0, 20);
      
      const { data, error } = await this.supabase
        .schema('ops')
        .from('scraped_urls')
        .select('url, title, full_content, ai_summary')
        .in('url', limitedUrls)
        .eq('company_name', company)
        .not('full_content', 'is', null)
        .limit(10); // Further limit results

      if (error) {
        console.warn('Error getting existing content:', error);
        return [];
      }

      return (data || [])
        .filter((item: any) => item.full_content)
        .map((item: any) => ({
          url: item.url,
          content: item.full_content,
          title: item.title || '',
          ai_summary: item.ai_summary
        }));
    } catch (error) {
      console.error('Error getting existing content:', error);
      return [];
    }
  }

  // Enhanced content quality assessment (inspired by Aston AI)
  assessContentQuality(
    content: string,
    title: string,
    url: string,
    contentType: ScrapedUrl['content_type']
  ): number {
    let score = 0.5; // Base score

    // Content length factor (enhanced thresholds)
    const wordCount = content.split(/\s+/).length;
    if (wordCount > 800) score += 0.25; // High-quality long content
    if (wordCount > 1500) score += 0.15; // Very comprehensive content
    if (wordCount < 50) score -= 0.4; // Too short, likely low quality
    if (wordCount < 20) return 0.1; // Extremely poor content
    
    // Aston AI pattern: Check for structured interview content
    const contentLower = content.toLowerCase();
    const titleLower = title.toLowerCase();
    
    // Interview experience quality indicators (Aston AI inspired)
    const qualityPatterns = [
      /interview\s+(process|experience|stages?)/gi,
      /asked\s+me\s+(about|to)/gi,
      /\d+\s+(rounds?|stages?|steps?)/gi,
      /(technical|behavioral|coding)\s+(questions?|interview)/gi,
      /hiring\s+(manager|process|decision)/gi,
      /offer\s+(extended|received|rejected)/gi
    ];
    
    const qualityMatches = qualityPatterns.reduce((count, pattern) => {
      return count + (content.match(pattern) || []).length;
    }, 0);
    
    if (qualityMatches >= 3) score += 0.3; // High interview relevance
    if (qualityMatches >= 5) score += 0.2; // Excellent interview content

    // Content type factor
    switch (contentType) {
      case 'interview_review':
        score += 0.3;
        break;
      case 'company_info':
        score += 0.2;
        break;
      case 'job_posting':
        score += 0.1;
        break;
      default:
        score += 0.0;
    }

    // URL quality indicators
    if (url.includes('glassdoor') || url.includes('blind') || url.includes('leetcode')) {
      score += 0.2;
    }
    if (url.includes('1point3acres') || url.includes('reddit.com/r/')) {
      score += 0.15;
    }

    // Title quality indicators
    if (titleLower.includes('interview') || titleLower.includes('experience')) {
      score += 0.1;
    }
    if (titleLower.includes('question') || titleLower.includes('review')) {
      score += 0.1;
    }

    // Content quality indicators
    if (contentLower.includes('interview process') || contentLower.includes('interviewer asked')) {
      score += 0.1;
    }
    if (contentLower.includes('question') && contentLower.includes('answer')) {
      score += 0.1;
    }

    // Ensure score is between 0 and 1
    return Math.max(0, Math.min(1, score));
  }

  // Classify content type based on URL and content
  classifyContentType(url: string, title: string, content: string): ScrapedUrl['content_type'] {
    const urlLower = url.toLowerCase();
    const titleLower = title.toLowerCase();
    const contentLower = content.toLowerCase();

    // Interview review sites
    if (urlLower.includes('glassdoor') || urlLower.includes('blind') || 
        urlLower.includes('1point3acres') || urlLower.includes('leetcode')) {
      if (titleLower.includes('interview') || contentLower.includes('interview experience')) {
        return 'interview_review';
      }
    }

    // Job posting indicators
    if (urlLower.includes('jobs') || urlLower.includes('careers') || 
        titleLower.includes('job') || titleLower.includes('position')) {
      return 'job_posting';
    }

    // News/blog content
    if (urlLower.includes('blog') || urlLower.includes('news') || 
        urlLower.includes('medium') || urlLower.includes('linkedin')) {
      return 'news';
    }

    // Company info
    if (contentLower.includes('company culture') || contentLower.includes('about us') ||
        titleLower.includes('company') || titleLower.includes('culture')) {
      return 'company_info';
    }

    // Interview-related content
    if (titleLower.includes('interview') || contentLower.includes('interview process')) {
      return 'interview_review';
    }

    return 'other';
  }

  // Extract questions from content using simple pattern matching
  extractQuestions(content: string): string[] {
    const questions: string[] = [];
    
    // Look for common question patterns
    const questionPatterns = [
      /(?:Q\d*[:\.]?\s*|Question\s*\d*[:\.]?\s*)(.*?\?)/gi,
      /(?:They asked|Asked|Question was|The question)[:\s]+(.*?\?)/gi,
      /(?:^|\n)\s*\d+\.\s*(.*?\?)/gm,
      /(?:Interview question|Question)[:\s]+(.*?\?)/gi
    ];

    questionPatterns.forEach(pattern => {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[1].trim().length > 10) {
          questions.push(match[1].trim());
        }
      }
    });

    // Remove duplicates and filter out very short or very long questions
    const uniqueQuestions = Array.from(new Set(questions))
      .filter(q => q.length > 10 && q.length < 500)
      .slice(0, 20); // Limit to 20 questions per content

    return uniqueQuestions;
  }

  // Extract key insights from content
  extractInsights(content: string): string[] {
    const insights: string[] = [];
    
    // Look for insight patterns
    const insightPatterns = [
      /(?:Key insight|Important|Note|Tip|Advice)[:\s]+(.*?)(?:\.|$)/gi,
      /(?:What I learned|Takeaway|Key point)[:\s]+(.*?)(?:\.|$)/gi,
      /(?:Pro tip|Remember|Important to note)[:\s]+(.*?)(?:\.|$)/gi
    ];

    insightPatterns.forEach(pattern => {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[1].trim().length > 15) {
          insights.push(match[1].trim());
        }
      }
    });

    // Remove duplicates and limit
    const uniqueInsights = Array.from(new Set(insights))
      .filter(insight => insight.length > 15 && insight.length < 300)
      .slice(0, 10);

    return uniqueInsights;
  }

  // Increment URL reuse counter
  async incrementUrlReuse(urlId: string): Promise<void> {
    try {
      // Use RPC function for atomic increment
      await this.supabase.schema('ops').rpc('increment_url_reuse_count', {
        url_id: urlId
      });
    } catch (error) {
      console.error('Error incrementing URL reuse:', error);
    }
  }

  // Clean up old URLs (simplified)
  async cleanupOldUrls(maxAgeDays: number = 90, minQualityScore: number = 0.1): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .schema('ops')
        .from('scraped_urls')
        .delete()
        .lt('content_quality_score', minQualityScore)
        .eq('times_reused', 0)
        .lt('first_scraped_at', new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;
      return data?.length || 0;
    } catch (error) {
      console.error('Error cleaning up old URLs:', error);
      return 0;
    }
  }
}
