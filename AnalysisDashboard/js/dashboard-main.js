/**
 * Analytics Dashboard - Main Dashboard Controller
 * Coordinates data loading, metric updates, and chart initialization
 */

class AnalyticsDashboard {
    constructor() {
        this.isInitialized = false;
        this.currentMetrics = {};
        this.refreshInProgress = false;
    }

    async init() {
        if (this.isInitialized) return;
        
        console.log('Initializing Analytics Dashboard...');
        
        try {
            // Show loading state
            window.analyticsUtils.showLoading();
            
            // Load initial data and populate dashboard
            await this.loadInitialData();
            await this.initializeCharts();
            await this.updateMetrics();
            await this.updateInsights();
            
            // Hide loading and show content
            window.analyticsUtils.hideLoading();
            
            this.isInitialized = true;
            console.log('Dashboard initialized successfully');
            
        } catch (error) {
            console.error('Error initializing dashboard:', error);
            window.analyticsUtils.showError('Failed to initialize dashboard. Please refresh the page.');
        }
    }

    async loadInitialData() {
        // Ensure AnalysisData adapter is available and repositories are discovered
        if (!window.analysisDataAdapter) {
            console.error('❌ AnalysisData adapter not found. Make sure analysis-data-adapter.js is loaded.');
            return;
        }
        
        // Discover repositories first (this will probe for commits.json in known folders)
        if (!window.analyticsUtils.repositories || window.analyticsUtils.repositories.length === 0) {
            console.log('🔍 Discovering repositories from AnalysisData folder...');
            await window.analyticsUtils.discoverRepositories();
            
            if (window.analyticsUtils.repositories.length === 0) {
                console.warn('⚠️ No repositories discovered. Dashboard will show empty data.');
                return;
            }
            console.log(`✅ Discovered ${window.analyticsUtils.repositories.length} repository/repositories:`, window.analyticsUtils.repositories);
        }
        
        // Check if we have git-data configuration (legacy support)
        if (window.GIT_DATA_CONFIG) {
            console.log('🔄 Loading git-data results...');
            try {
                // Load main git data summary
                const response = await fetch(window.GIT_DATA_CONFIG.dataSource);
                const gitSummary = await response.json();

                // Store git data in utils cache
                window.analyticsUtils.cache['git_data_summary'] = gitSummary;

                // Load individual repository data
                for (const [repoName, filePath] of Object.entries(window.GIT_DATA_CONFIG.repositoryFiles)) {
                    try {
                        const repoResponse = await fetch(filePath);
                        const repoData = await repoResponse.json();
                        window.analyticsUtils.cache[`repo_${repoName}`] = repoData;
                        console.log(`✅ Loaded ${repoName} repository data`);
                    } catch (error) {
                        console.warn(`⚠️ Failed to load ${repoName} data:`, error);
                    }
                }

                console.log('✅ Git data loading completed');
                return;
            } catch (error) {
                console.error('❌ Failed to load git data, falling back to original data source:', error);
            }
        }

        // Load data from AnalysisData adapter (current approach)
        console.log('📊 Loading data from AnalysisData folder...');
        const loadPromises = [
            window.analyticsUtils.loadDeveloperContributions(),
            window.analyticsUtils.loadRegionalAnalysis(),
            window.analyticsUtils.loadCommitAnalysis(),
            window.analyticsUtils.loadTechnologyStack(),
            window.analyticsUtils.loadModuleOwnership(),
            window.analyticsUtils.loadOverallSummary()
        ];

        await Promise.allSettled(loadPromises);
        console.log('✅ Initial data loading completed');
    }

    async initializeCharts() {
        console.log('Initializing charts...');
        
        // Initialize charts sequentially to avoid race conditions (especially for maps)
        try {
            await window.analyticsCharts.createCommitTimelineChart('commitTimelineChart');
            await window.analyticsCharts.createDeveloperDistributionChart('developerDistributionChart');
            await window.analyticsCharts.createTechnologyStackChart('technologyStackChart');
            
            // Initialize map last to ensure DOM is fully ready
            await window.analyticsCharts.createGlobalActivityMap('globalActivityMap');
            
            console.log('Charts initialization completed');
        } catch (error) {
            console.error('Error during chart initialization:', error);
            // Continue even if some charts fail to initialize
        }
    }

    setupCharts() {
        console.log('📈 Setting up charts...');
        
        // Check data source and setup appropriate charts
        if (window.GIT_DATA_CONFIG && window.analyticsUtils.cache['git_data_summary']) {
            this.setupGitDataCharts();
        } else {
            this.setupOriginalCharts();
        }

        console.log('📈 Charts setup completed');
    }

    setupGitDataCharts() {
        const gitSummary = window.analyticsUtils.cache['git_data_summary'];

        // 1. Commit Activity Timeline
        if (gitSummary.commits.by_year) {
            const years = Object.keys(gitSummary.commits.by_year).sort();
            const commitCounts = years.map(year => gitSummary.commits.by_year[year]);

            window.analyticsCharts.createLineChart('commitTimelineChart', {
                categories: years,
                series: [{
                    name: 'Commits',
                    data: commitCounts,
                    color: '#3B82F6'
                }],
                title: 'Commit Activity Over Time'
            });
        }

        // 2. Top Contributors Chart
        if (gitSummary.authors.top_contributors) {
            const contributors = Object.entries(gitSummary.authors.top_contributors)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10);

            window.analyticsCharts.createBarChart('contributorsChart', {
                categories: contributors.map(([name]) => name),
                series: [{
                    name: 'Commits',
                    data: contributors.map(([,commits]) => commits),
                    color: '#10B981'
                }],
                title: 'Top Contributors'
            });
        }

        // 3. Language Distribution
        if (gitSummary.languages.top_languages) {
            const langData = Object.entries(gitSummary.languages.top_languages)
                .slice(0, 8)
                .map(([lang, count]) => ({
                    name: lang.replace('.', ''),
                    value: count
                }));

            window.analyticsCharts.createDonutChart('languageChart', {
                data: langData,
                title: 'Language Distribution'
            });
        }

        // 4. Repository Comparison
        const repoData = [];
        for (const repoName of gitSummary.repositories.names) {
            const repoCache = window.analyticsUtils.cache[`repo_${repoName}`];
            if (repoCache) {
                repoData.push({
                    name: repoName,
                    commits: repoCache.total_commits,
                    authors: Object.keys(repoCache.authors).length
                });
            }
        }

        if (repoData.length > 0) {
            window.analyticsCharts.createBarChart('repositoryChart', {
                categories: repoData.map(r => r.name),
                series: [{
                    name: 'Commits',
                    data: repoData.map(r => r.commits),
                    color: '#8B5CF6'
                }],
                title: 'Repository Activity'
            });
        }

        console.log('📊 Git data charts created');
    }

    setupOriginalCharts() {
        // Create original charts with existing data
        this.createCommitActivityChart();
        this.createContributorDistributionChart();
        this.createTechnologyStackChart();
        this.createRegionalChart();

        console.log('📊 Original charts created');
    }

    createCommitActivityChart() {
        const commitData = window.analyticsUtils.cache['commit_analysis'];
        if (commitData && commitData.monthly_commits) {
            const months = Object.keys(commitData.monthly_commits).sort();
            const counts = months.map(month => commitData.monthly_commits[month]);

            window.analyticsCharts.createLineChart('commitTimelineChart', {
                categories: months,
                series: [{
                    name: 'Monthly Commits',
                    data: counts,
                    color: '#3B82F6'
                }],
                title: 'Commit Activity Timeline'
            });
        }
    }

    createContributorDistributionChart() {
        const developerData = window.analyticsUtils.cache['developer_contributions'];
        if (developerData && developerData.top_contributors) {
            const contributors = Object.entries(developerData.top_contributors)
                .sort(([,a], [,b]) => b.total_commits - a.total_commits)
                .slice(0, 10);

            window.analyticsCharts.createBarChart('contributorsChart', {
                categories: contributors.map(([name]) => name),
                series: [{
                    name: 'Commits',
                    data: contributors.map(([,data]) => data.total_commits),
                    color: '#10B981'
                }],
                title: 'Top Contributors'
            });
        }
    }

    createTechnologyStackChart() {
        const techData = window.analyticsUtils.cache['technology_stack'];
        if (techData && techData.languages) {
            const langData = techData.languages.slice(0, 8).map(item => ({
                name: item.technology,
                value: item.usage_count
            }));

            window.analyticsCharts.createDonutChart('languageChart', {
                data: langData,
                title: 'Technology Stack Distribution'
            });
        }
    }

    createRegionalChart() {
        const regionalData = window.analyticsUtils.cache['regional_analysis'];
        if (regionalData && regionalData.regional_summary) {
            const regions = Object.entries(regionalData.regional_summary);

            window.analyticsCharts.createBarChart('regionalChart', {
                categories: regions.map(([name]) => name),
                series: [{
                    name: 'Developers',
                    data: regions.map(([,data]) => data.developers_count || data.unique_developers || 0),
                    color: '#F59E0B'
                }],
                title: 'Regional Distribution'
            });
        }
    }

    async updateMetrics() {
        console.log('Updating dashboard metrics...');
        
        // Update metrics based on data source (git-data or original)
        if (window.GIT_DATA_CONFIG && window.analyticsUtils.cache['git_data_summary']) {
            this.updateGitDataMetrics();
        } else {
            this.updateOriginalMetrics();
    }
    }

    updateGitDataMetrics() {
        const gitSummary = window.analyticsUtils.cache['git_data_summary'];

        // Update main metrics with git data
        this.updateElement('totalCommits', this.formatNumber(gitSummary.commits.total_commits));
        this.updateElement('totalContributors', this.formatNumber(gitSummary.authors.total_unique));
        this.updateElement('totalRepos', this.formatNumber(gitSummary.repositories.total_count));
        this.updateElement('activeYears', gitSummary.activity_timeline.total_years);

        // Update language distribution
        if (gitSummary.languages && gitSummary.languages.top_languages) {
            const topLang = Object.keys(gitSummary.languages.top_languages)[0];
            this.updateElement('primaryLanguage', topLang ? topLang.replace('.', '') : 'Mixed');
        }

        // Update time range
        const timeRange = `${gitSummary.activity_timeline.first_year}-${gitSummary.activity_timeline.last_year}`;
        this.updateElement('analysisTimeframe', timeRange);

        console.log('📊 Updated metrics with git data');
    }

    updateOriginalMetrics() {
        // Get data from Analytics format
        const summary = window.analyticsUtils.cache['overall_summary'];
        const developerData = window.analyticsUtils.cache['developer_contributions'];
        const regionalData = window.analyticsUtils.cache['regional_analysis'];
        const techStack = window.analyticsUtils.cache['technology_stack'];

        // Update basic metrics using Analytics data structure
        if (summary) {
            // Handle both aggregated and single-year data structures
            let totalCommits = 0;
            let totalDevelopers = 0;
            let globalRegions = 0;
            
            if (summary.combined_metrics) {
                // Aggregated data structure
                totalCommits = summary.combined_metrics.total_commits || 0;
                totalDevelopers = summary.combined_metrics.active_contributors || 0;
                globalRegions = summary.combined_metrics.global_regions || 0;
            } else {
                // Single year data structure
                totalCommits = summary.total_commits || 0;
            }
            
            this.updateElement('totalCommits', this.formatNumber(totalCommits));
            console.log(`📊 Updated Total Commits: ${totalCommits}`);
        }

        if (developerData) {
            // Analytics developer_contributions has: {total_developers, developers: {...}}
            const contributorCount = developerData.total_developers || 0;
            this.updateElement('totalContributors', this.formatNumber(contributorCount));
            console.log(`👥 Updated Total Contributors: ${contributorCount}`);
        }

        // Update repository count from discovered repositories - NO HARDCODED COUNT
        const repoCount = window.analyticsUtils?.repositories?.length || 
                        (window.analysisDataAdapter?.repositories?.length) || 0;
        this.updateElement('totalRepos', this.formatNumber(repoCount));
        if (repoCount > 0) {
            console.log(`📁 Repository count: ${repoCount}`);
        }

        // Calculate active years and global regions
        if (summary) {
            let currentYear, globalRegions = 0;
            
            if (summary.combined_metrics) {
                // Aggregated data - use current year
                currentYear = new Date().getFullYear();
                globalRegions = summary.combined_metrics.global_regions || 0;
            } else if (summary.year) {
                // Single year data
                currentYear = summary.year;
            }
            
            if (currentYear) {
                // Get start year from actual commit data - NO HARDCODED YEAR
                let startYear = null;
                
                // Try to get from commit data
                const commitData = window.analyticsUtils.cache['commit_analysis'];
                if (commitData && commitData.commits_by_month) {
                    const months = Object.keys(commitData.commits_by_month).sort();
                    if (months.length > 0) {
                        const firstMonth = months[0];
                        startYear = parseInt(firstMonth.split('-')[0]);
                    }
                }
                
                // Fallback to summary data
                if (!startYear && summary) {
                    startYear = summary.first_commit_year || 
                               (summary.first_commit_date ? parseInt(summary.first_commit_date.split('-')[0]) : null);
                }
                
                // Calculate active years only if we have a valid start year
                if (startYear && !isNaN(startYear)) {
                    const activeYears = currentYear - startYear + 1;
                    this.updateElement('activeYears', activeYears);
                }
            }
            
            // Update Global Regions if we have it
            if (globalRegions > 0) {
                this.updateElement('totalRegions', this.formatNumber(globalRegions));
                console.log(`🌍 Updated Global Regions: ${globalRegions}`);
            }
        }
        
        // Update Global Regions from regional data if not set from summary
        if (regionalData && regionalData.total_regions) {
            this.updateElement('totalRegions', this.formatNumber(regionalData.total_regions));
            console.log(`🌍 Updated Global Regions from regional data: ${regionalData.total_regions}`);
        }

        // Update technology info and tech stack diversity
        if (techStack && techStack.overall_technology_usage) {
            // Get the top technology by usage count
            const technologies = Object.entries(techStack.overall_technology_usage);
            if (technologies.length > 0) {
                const topTech = technologies.sort(([,a], [,b]) => b - a)[0][0];
                this.updateElement('primaryLanguage', topTech.toUpperCase());
                
                // Update tech stack diversity count
                const techStackDiversityCount = technologies.length;
                this.updateElement('techStackCount', this.formatNumber(techStackDiversityCount));
                console.log(`🔧 Updated Tech Stack Diversity: ${techStackDiversityCount} technologies`);
            }
        } else if (summary && summary.combined_metrics && summary.combined_metrics.tech_stack_diversity) {
            // Use tech stack diversity from aggregated summary if available
            const techDiversity = summary.combined_metrics.tech_stack_diversity;
            this.updateElement('techStackCount', this.formatNumber(techDiversity));
            console.log(`🔧 Updated Tech Stack Diversity from summary: ${techDiversity}`);
        }

        // Update analysis timeframe - get from actual commit data, NO HARDCODED YEARS
        let firstYear = null;
        let timeRange = 'All Time';
        
        // Try to get first commit year from commit data
        const commitData = window.analyticsUtils.cache['commit_analysis'];
        if (commitData && commitData.commits_by_month) {
            const months = Object.keys(commitData.commits_by_month).sort();
            if (months.length > 0) {
                firstYear = parseInt(months[0].split('-')[0]);
            }
        }
        
        // Fallback to summary data
        if (!firstYear && summary) {
            firstYear = summary.first_commit_year || 
                       (summary.first_commit_date ? parseInt(summary.first_commit_date.split('-')[0]) : null);
        }
        
        if (firstYear && !isNaN(firstYear)) {
            const currentYear = new Date().getFullYear();
            timeRange = summary?.year ? `${summary.year} Analysis` : `${firstYear}-${currentYear}`;
        } else {
            // If we truly can't determine, show current year only
            timeRange = `${new Date().getFullYear()} Analysis`;
        }
        
        this.updateElement('analysisTimeframe', timeRange);

        console.log('📊 Updated metrics with Analytics data');
    }

    // Force refresh by clearing cache and reloading
    async forceRefresh() {
        console.log('🔄 Forcing dashboard refresh...');
        window.analyticsUtils.clearCache();
        
        // Show loading
        window.analyticsUtils.showLoading();
        
        try {
            // Reload all data
            await this.loadInitialData();
            await this.updateMetrics();
            await this.updateInsights();
            
            // Refresh charts
            await window.analyticsCharts.refreshAllCharts();
            
        } catch (error) {
            console.error('Error during force refresh:', error);
            window.analyticsUtils.showError('Failed to refresh dashboard data');
        } finally {
            window.analyticsUtils.hideLoading();
        }
    }

    updateElement(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        }
    }

    formatNumber(num) {
        if (typeof num !== 'number') return '0';
        return new Intl.NumberFormat().format(num);
    }
    calculateChangePercentage(current, previous) {
        if (!previous || previous === 0) return 0;
        return parseFloat(((current - previous) / previous * 100).toFixed(1));
    }

    async refreshDashboard() {
        if (this.refreshInProgress) {
            console.log('Refresh already in progress...');
            return;
        }

        this.refreshInProgress = true;
        console.log('Refreshing dashboard with current filters...');

        try {
            window.analyticsUtils.showLoading();
            // Clear cache and reload data
            window.analyticsUtils.clearCache();
            
            // Reload all data with current filters
            await this.loadInitialData();
            
            // Refresh charts with better error handling
            try {
                await window.analyticsCharts.refreshAllCharts();
                console.log('📊 All charts refreshed successfully');
            } catch (chartError) {
                console.error('📊 Error refreshing charts:', chartError);
                // Continue with metrics update even if charts fail
            }
            
            // Update metrics and insights
            await this.updateMetrics();
            await this.updateInsights();

            window.analyticsUtils.hideLoading();

        } catch (error) {
            console.error('Error refreshing dashboard:', error);
            window.analyticsUtils.showError('Failed to refresh dashboard data');
        } finally {
            this.refreshInProgress = false;
        }
    }

    async updateInsights() {
        console.log('Updating strategic insights...');
        try {
            const [
                developerData,
                regionalData,
                techData
            ] = await Promise.all([
                window.analyticsUtils.loadDeveloperContributions(),
                window.analyticsUtils.loadRegionalAnalysis(),
                window.analyticsUtils.loadTechnologyStack()
            ]);

            const insights = this.generateInsights(developerData, regionalData, techData);
            this.updateInsightElements(insights);
        } catch (error) {
            console.error('Error updating insights:', error);
            }
    }

    generateInsights(developerData, regionalData, techData) {
        const insights = {
            balance: '',
            collaboration: '',
            technology: ''
        };

        // Development Balance Insight - handle Analytics data structure
        if (regionalData && (regionalData.regional_breakdown || regionalData.regional_summary)) {
            const regionData = regionalData.regional_breakdown || regionalData.regional_summary;
            const regions = Object.values(regionData);
            
            if (regions.length > 0) {
                const totalDevs = regions.reduce((sum, region) => sum + (region.developers_count || region.unique_developers || 0), 0);
                const maxRegion = regions.reduce((max, region) => {
                    const maxCount = max.developers_count || max.unique_developers || 0;
                    const currentCount = region.developers_count || region.unique_developers || 0;
                    return currentCount > maxCount ? region : max;
                }, regions[0]);

                const maxCount = maxRegion.developers_count || maxRegion.unique_developers || 0;
                const concentration = totalDevs > 0 ? ((maxCount / totalDevs) * 100).toFixed(1) : 0;
                insights.balance = `Development is ${concentration > 60 ? 'highly concentrated' : 'well distributed'} across regions. ${concentration}% of developers are in the primary region.`;
            } else {
                insights.balance = 'Development work is distributed globally across multiple regions.';
            }
        } else {
            insights.balance = 'Development work is distributed across multiple regions, promoting global collaboration.';
        }

        // Collaboration Insight
        if (developerData && developerData.collaboration_metrics) {
            const collabScore = developerData.collaboration_metrics.cross_regional_collaboration || 0;
            insights.collaboration = `Cross-regional collaboration score: ${(collabScore * 100).toFixed(1)}%.
                ${collabScore > 0.3 ? 'Strong' : 'Moderate'} collaboration between global teams.`;
        } else {
            insights.collaboration = 'Global teams are actively collaborating across time zones, enabling 24/7 development cycles.';
        }

        // Technology Focus Insight
        if (techData && techData.overall_technology_usage) {
            let dominantTech = 'C#';
            let techCount = 0;

            const techs = techData.overall_technology_usage;
            const topTech = Object.entries(techs).reduce((max, [tech, count]) =>
                count > max.count ? { tech, count } : max, { tech: '', count: 0 });
            dominantTech = topTech.tech.toUpperCase();
            techCount = Object.keys(techs).length;

            insights.technology = `Primary technology stack centers on ${dominantTech}.
                ${techCount} different technologies in use, indicating ${techCount > 10 ? 'high' : 'moderate'} technical diversity.`;
        } else {
            insights.technology = 'Technology stack employs multiple languages and frameworks, ensuring robust and scalable solutions.';
        }

        return insights;
    }

    updateInsightElements(insights) {
        const balanceInsightEl = document.getElementById('balanceInsight');
        if (balanceInsightEl) {
            balanceInsightEl.textContent = insights.balance;
        }

        const collaborationInsightEl = document.getElementById('collaborationInsight');
        if (collaborationInsightEl) {
            collaborationInsightEl.textContent = insights.collaboration;
        }

        const technologyInsightEl = document.getElementById('technologyInsight');
        if (technologyInsightEl) {
            technologyInsightEl.textContent = insights.technology;
        }
    }

    exportDashboardData() {
        const exportData = {
            timestamp: new Date().toISOString(),
            filters: window.analyticsUtils.currentFilters,
            metrics: this.currentMetrics,
            charts: Array.from(window.analyticsCharts.charts.keys())
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-dashboard-${new Date().getTime()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📊 DOM loaded, initializing dashboard...');

    const dashboard = new AnalyticsDashboard();
    window.analyticsDashboard = dashboard;

    // Global refresh function for filter application
    window.refreshDashboard = async function() {
        console.log('🔄 Global dashboard refresh triggered...');
        try {
            await window.analyticsDashboard.forceRefresh();
            console.log('✅ Dashboard refresh completed');
        } catch (error) {
            console.error('❌ Dashboard refresh failed:', error);
        }
    };

    await dashboard.init();

    // Set up filter event listeners after initialization
    setupFilterEventListeners();
});

// Filter event listeners setup
function setupFilterEventListeners() {
    console.log('📊 Setting up filter event listeners...');

    // Apply Filters button
    const applyFiltersBtn = document.getElementById('applyFilters');
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', async () => {
            const projectFilter = document.getElementById('projectFilter')?.value || 'all';
            const yearFilter = document.getElementById('yearFilter')?.value || 'all';

            // Get current filter values
            if (window.analyticsUtils) {
                window.analyticsUtils.currentFilters.project = projectFilter;
                window.analyticsUtils.currentFilters.year = yearFilter;
                console.log('📊 Updated filters:', window.analyticsUtils.currentFilters);
            }

            // Refresh dashboard with new filters
            await window.analyticsDashboard.refreshDashboard();
        });
    }

    // Auto-apply on dropdown change (optional for better UX)
    const projectFilter = document.getElementById('projectFilter');
    const yearFilter = document.getElementById('yearFilter');

    if (projectFilter) {
        projectFilter.addEventListener('change', () => {
            console.log('📊 Project filter changed to:', projectFilter.value);
        });
    }

    if (yearFilter) {
        yearFilter.addEventListener('change', () => {
            console.log('📊 Year filter changed to:', yearFilter.value);
        });
    }

    console.log('📊 Filter event listeners set up successfully');
}

// Handle page visibility for performance
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        console.log('📊 Page hidden, pausing updates');
    } else {
        console.log('📊 Page visible, resuming updates');
        if (window.analyticsDashboard && window.analyticsDashboard.isInitialized) {
        // Refresh charts when page becomes visible (handle browser optimization)
        setTimeout(() => {
                if (window.analyticsCharts) {
            window.analyticsCharts.handleResize();
    }
            }, 100);
        }
    }
});

// Export AnalyticsDashboard to window for external access
window.AnalyticsDashboard = AnalyticsDashboard;