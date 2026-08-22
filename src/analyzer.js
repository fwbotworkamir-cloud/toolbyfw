const chalk = require('chalk');

class Analyzer {
  constructor(db) {
    this.db = db;
  }

  generateReport(days = 30) {
    const insights = this.db.getAlgorithmInsights(days);
    const formats = this.db.getFormatDistribution(days);
    const titleStats = this.db.getTitleLengthStats(days);
    const sources = this.db.getTopSources(days, 15);
    const patterns = this.db.getTopPatterns(15);
    const topics = this.db.getTrendingTopics(7, 15);
    const powerWords = this.db.getPowerWordFrequency(days);
    const numberStats = this.db.getNumberUsageStats(days);
    const categories = this.db.getCategoryBreakdown(days);

    return {
      generated_at: new Date().toISOString(),
      period_days: days,
      total_articles: this.db.getArticleCount(),
      total_scans: this.db.getScanCount(),
      algorithm_signals: insights,
      format_distribution: formats,
      title_length_by_format: titleStats,
      number_usage: numberStats,
      top_sources: sources,
      top_patterns: patterns,
      trending_topics: topics,
      power_words: powerWords.slice(0, 30),
      category_breakdown: categories,
    };
  }

  printReport(days = 30) {
    const report = this.generateReport(days);

    console.log('\n' + chalk.bold.cyan('═══════════════════════════════════════════════'));
    console.log(chalk.bold.cyan('  DISCOVER ALGORITHM INTELLIGENCE REPORT'));
    console.log(chalk.bold.cyan('═══════════════════════════════════════════════'));
    console.log(chalk.gray(`  Generated: ${report.generated_at}`));
    console.log(chalk.gray(`  Period: last ${days} days | ${report.total_articles} articles | ${report.total_scans} scans`));

    // Algorithm signals
    const s = report.algorithm_signals;
    if (s.avgTitleLength) {
      console.log('\n' + chalk.bold.yellow('  🧠 ALGORITHM SIGNALS'));
      console.log(chalk.white(`  Avg title length:      ${s.avgTitleLength} words / ${s.avgTitleChars} chars`));
      console.log(chalk.white(`  Titles with numbers:   ${s.pctWithNumbers}%`));
      console.log(chalk.white(`  Starts with number:    ${s.pctStartsWithNumber}%`));
      console.log(chalk.white(`  Titles with questions: ${s.pctWithQuestions}%`));
      console.log(chalk.white(`  Titles with colons:    ${s.pctWithColon}%`));
      if (s.topFormat) console.log(chalk.white(`  Dominant format:       ${s.topFormat.format} (${s.topFormat.c} articles)`));
      if (s.topSource) console.log(chalk.white(`  Top source:            ${s.topSource.source} (${s.topSource.c} articles)`));
    }

    // Format distribution
    if (report.format_distribution.length > 0) {
      console.log('\n' + chalk.bold.yellow('  📊 FORMAT DISTRIBUTION'));
      for (const f of report.format_distribution) {
        const bar = '█'.repeat(Math.round(f.pct / 2));
        console.log(chalk.white(`  ${(f.format || 'unknown').padEnd(15)} ${String(f.pct + '%').padEnd(7)} ${chalk.cyan(bar)} (${f.count})`));
      }
    }

    // Title length by format
    if (report.title_length_by_format.length > 0) {
      console.log('\n' + chalk.bold.yellow('  📏 TITLE LENGTH BY FORMAT'));
      console.log(chalk.gray('  Format          Avg Words  Avg Chars  Sample'));
      for (const t of report.title_length_by_format) {
        console.log(chalk.white(`  ${(t.format || '?').padEnd(16)} ${String(t.avg_words).padEnd(10)} ${String(t.avg_chars).padEnd(10)} ${t.sample_size}`));
      }
    }

    // Number usage
    if (report.number_usage && report.number_usage.total > 0) {
      const n = report.number_usage;
      console.log('\n' + chalk.bold.yellow('  🔢 TITLE ELEMENT USAGE'));
      console.log(chalk.white(`  Contains number:    ${n.with_number}/${n.total} (${(n.with_number/n.total*100).toFixed(1)}%)`));
      console.log(chalk.white(`  Starts with number: ${n.starts_with_number}/${n.total} (${(n.starts_with_number/n.total*100).toFixed(1)}%)`));
      console.log(chalk.white(`  Has question mark:  ${n.with_question}/${n.total} (${(n.with_question/n.total*100).toFixed(1)}%)`));
      console.log(chalk.white(`  Has colon:          ${n.with_colon}/${n.total} (${(n.with_colon/n.total*100).toFixed(1)}%)`));
      console.log(chalk.white(`  Has dash/emdash:    ${n.with_dash}/${n.total} (${(n.with_dash/n.total*100).toFixed(1)}%)`));
    }

    // Power words
    if (report.power_words.length > 0) {
      console.log('\n' + chalk.bold.yellow('  ⚡ TOP POWER WORDS'));
      for (const pw of report.power_words.slice(0, 15)) {
        const bar = '█'.repeat(Math.min(pw.count, 40));
        console.log(chalk.white(`  ${pw.word.padEnd(18)} ${chalk.green(bar)} ${pw.count}`));
      }
    }

    // Top sources
    if (report.top_sources.length > 0) {
      console.log('\n' + chalk.bold.yellow('  🏢 TOP SOURCES (Who Dominates Discover)'));
      for (const s of report.top_sources.slice(0, 10)) {
        console.log(chalk.white(`  ${(s.source || '?').padEnd(25)} ${String(s.count).padEnd(5)} [${s.categories}]`));
      }
    }

    // Trending topics
    if (report.trending_topics.length > 0) {
      console.log('\n' + chalk.bold.yellow('  🔥 TRENDING TOPICS (7 days)'));
      for (const t of report.trending_topics.slice(0, 10)) {
        console.log(chalk.white(`  ${(t.topic || '?').padEnd(25)} ${t.appearances} appearances [${t.category}]`));
      }
    }

    // Category breakdown
    if (report.category_breakdown.length > 0) {
      console.log('\n' + chalk.bold.yellow('  📁 CATEGORY BREAKDOWN'));
      console.log(chalk.gray('  Category        Count   Avg Words  #Numbers  ?Questions'));
      for (const c of report.category_breakdown) {
        console.log(chalk.white(`  ${(c.category || '?').padEnd(16)} ${String(c.count).padEnd(7)} ${String(c.avg_title_words).padEnd(10)} ${String(c.titles_with_numbers).padEnd(9)} ${c.titles_with_questions}`));
      }
    }

    console.log('\n' + chalk.bold.cyan('═══════════════════════════════════════════════\n'));

    return report;
  }

  // Return JSON data for dashboard API
  getDashboardData(days = 30) {
    return this.generateReport(days);
  }
}

module.exports = Analyzer;
