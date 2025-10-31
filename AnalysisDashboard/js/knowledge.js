class KnowledgeDashboard {
    constructor() {
        this.technologyData = null;
        this.overallData = null;
        this.charts = new Map();
        
        // Initialize utils with fallback
        try {
            this.utils = window.analyticsUtils;
            if (!this.utils) {
                console.error('Failed to initialize AnalyticsUtils');
            }
        } catch (error) {
            console.error('Error initializing utils:', error);
            this.utils = null;
        }
    }

    async initialize() {
        try {
            await this.loadKnowledgeData();
            await this.initializeCharts();
            await this.updateMetrics();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Show dashboard content
            document.getElementById('loadingIndicator').classList.add('hidden');
            document.getElementById('dashboardContent').classList.remove('hidden');
            
            // Update timestamp
            if (this.utils && typeof this.utils.updateTimestamp === 'function') {
                this.utils.updateTimestamp();
            }
            
        } catch (error) {
            console.error('Error initializing knowledge dashboard:', error);
            this.showError('Failed to load knowledge analytics data');
        }
    }

    async loadKnowledgeData() {
        // Load both technology stack and overall summary data
        if (!this.utils) {
            throw new Error('Utils not initialized properly');
        }
        
        this.technologyData = await this.utils.loadTechnologyStack();
        this.overallData = await this.utils.loadOverallSummary();
        console.log('Loaded knowledge data:', { tech: this.technologyData, overall: this.overallData });
    }

    async initializeCharts() {
        const chartPromises = [
            this.createDocumentationTrendsChart(),
            this.createTechDebtDistributionChart()
        ];

        await Promise.allSettled(chartPromises);
        console.log('Knowledge charts initialization completed');
    }

    async createDocumentationTrendsChart() {
        const container = document.getElementById('documentationTrends');
        if (!container) return;

        try {
            // Check if direct documentation trends data exists
            if (this.technologyData?.documentation_trends) {
                const trendsData = this.technologyData.documentation_trends;
                const timeLabels = Object.keys(trendsData);
                const trendValues = Object.values(trendsData);

                const options = {
                    series: [{
                        name: 'Documentation Coverage',
                        data: trendValues
                    }],
                    chart: {
                        type: 'area',
                        height: '100%',
                        toolbar: {
                            show: false
                        }
                    },
                    xaxis: {
                        categories: timeLabels,
                        labels: {
                            style: {
                                fontSize: '12px'
                            }
                        }
                    },
                    yaxis: {
                        labels: {
                            formatter: function(value) {
                                return Math.round(value) + '%';
                            }
                        }
                    },
                    colors: ['#3B82F6'],
                    fill: {
                        type: 'gradient',
                        gradient: {
                            shade: 'light',
                            type: 'vertical',
                            shadeIntensity: 0.25,
                            gradientToColors: ['#1E40AF'],
                            inverseColors: false,
                            opacityFrom: 0.85,
                            opacityTo: 0.25
                        }
                    },
                    stroke: {
                        curve: 'smooth',
                        width: 2
                    }
                };

                const chart = new ApexCharts(container, options);
                await chart.render();
                this.charts.set('documentationTrends', chart);
            } else {
                // No direct documentation trends data available
                container.innerHTML = `
                    <div class="flex items-center justify-center h-full text-gray-500">
                        <div class="text-center">
                            <i class="fas fa-file-alt text-4xl mb-4"></i>
                            <p>No documentation trends data available</p>
                            <p class="text-sm mt-2">Direct documentation metrics not found in source data</p>
                        </div>
                    </div>
                `;
            }

        } catch (error) {
            console.error('Error creating documentation trends chart:', error);
            container.innerHTML = '<div class="flex items-center justify-center h-full text-gray-500">Error loading chart data</div>';
        }
    }

    async createTechDebtDistributionChart() {
        const container = document.getElementById('techDebtDistribution');
        if (!container) return;

        try {
            // Check if direct technical debt distribution data exists
            if (this.technologyData?.technical_debt_distribution) {
                const debtData = this.technologyData.technical_debt_distribution;
                const categories = Object.keys(debtData);
                const values = Object.values(debtData);

                const options = {
                    series: values,
                    chart: {
                        type: 'pie',
                        height: '100%'
                    },
                    labels: categories,
                    colors: ['#DC2626', '#EA580C', '#CA8A04', '#7C3AED'],
                    legend: {
                        position: 'bottom',
                        fontSize: '14px'
                    },
                    dataLabels: {
                        enabled: true,
                        formatter: function (val) {
                            return Math.round(val) + '%';
                        }
                    }
                };

                const chart = new ApexCharts(container, options);
                await chart.render();
                this.charts.set('techDebtDistribution', chart);
            } else {
                // No direct technical debt distribution data available
                container.innerHTML = `
                    <div class="flex items-center justify-center h-full text-gray-500">
                        <div class="text-center">
                            <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                            <p>No technical debt distribution data available</p>
                            <p class="text-sm mt-2">Direct technical debt metrics not found in source data</p>
                        </div>
                    </div>
                `;
            }

        } catch (error) {
            console.error('Error creating tech debt distribution chart:', error);
            container.innerHTML = '<div class="flex items-center justify-center h-full text-gray-500">Error loading chart data</div>';
        }
    }

    async updateMetrics() {
        console.log('📚 Checking for direct knowledge management data...');
        console.log('📚 Technology data available:', !!this.technologyData);
        console.log('📚 Overall data available:', !!this.overallData);
        
        try {
            // Check for direct documentation metrics in the data
            const docCoverageEl = document.getElementById('docCoverage');
            if (docCoverageEl) {
                if (this.technologyData?.documentation_coverage !== undefined) {
                    docCoverageEl.textContent = `${this.technologyData.documentation_coverage}%`;
                } else {
                    docCoverageEl.textContent = 'No Data';
                }
            }

            // Check for direct technical debt scores in the data
            const techDebtScoreEl = document.getElementById('techDebtScore');
            if (techDebtScoreEl) {
                if (this.technologyData?.technical_debt_score !== undefined) {
                    techDebtScoreEl.textContent = this.technologyData.technical_debt_score.toString();
                } else {
                    techDebtScoreEl.textContent = 'No Data';
                }
            }

            // Check for direct knowledge articles count in the data
            const knowledgeArticlesEl = document.getElementById('knowledgeArticles');
            if (knowledgeArticlesEl) {
                if (this.technologyData?.knowledge_articles !== undefined) {
                    knowledgeArticlesEl.textContent = this.technologyData.knowledge_articles.toLocaleString();
                } else {
                    knowledgeArticlesEl.textContent = 'No Data';
                }
            }

            // Check for direct code complexity metrics in the data
            const codeComplexityEl = document.getElementById('codeComplexity');
            if (codeComplexityEl) {
                if (this.technologyData?.code_complexity !== undefined) {
                    codeComplexityEl.textContent = this.technologyData.code_complexity;
                } else {
                    codeComplexityEl.textContent = 'No Data';
                }
            }

            console.log('📚 Knowledge metrics updated with direct data only');

            // Update knowledge base status with direct data
            this.updateKnowledgeBaseStatus();

        } catch (error) {
            console.error('Error updating knowledge metrics:', error);
            // Show "No Data" for all metrics if there's an error
            const docCoverageEl = document.getElementById('docCoverage');
            if (docCoverageEl) docCoverageEl.textContent = 'No Data';
            
            const techDebtScoreEl = document.getElementById('techDebtScore');
            if (techDebtScoreEl) techDebtScoreEl.textContent = 'No Data';
            
            const knowledgeArticlesEl = document.getElementById('knowledgeArticles');
            if (knowledgeArticlesEl) knowledgeArticlesEl.textContent = 'No Data';
            
            const codeComplexityEl = document.getElementById('codeComplexity');
            if (codeComplexityEl) codeComplexityEl.textContent = 'No Data';
        }
    }

    updateKnowledgeBaseStatus() {
        const container = document.getElementById('knowledgeBaseStatus');
        if (!container) return;

        // Only show direct data if it exists in the technology data
        const hasApiDocs = this.technologyData?.api_documentation_coverage !== undefined;
        const hasSecurityDocs = this.technologyData?.security_documentation_coverage !== undefined;
        const hasPlatformDocs = this.technologyData?.platform_documentation_coverage !== undefined;

        if (!hasApiDocs && !hasSecurityDocs && !hasPlatformDocs) {
            container.innerHTML = `
                <div class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <h4 class="font-semibold text-gray-900 dark:text-gray-300 mb-2">Knowledge Base Status</h4>
                    <p class="text-sm text-gray-600 dark:text-gray-400">No direct documentation metrics available in the data.</p>
                </div>
            `;
            return;
        }

        let statusContent = '';

        if (hasApiDocs) {
            const apiCoverage = this.technologyData.api_documentation_coverage;
            statusContent += `
                <div class="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
                    <h4 class="font-semibold text-green-900 dark:text-green-300 mb-2">API Documentation</h4>
                    <div class="flex justify-between items-center">
                        <span class="text-sm text-green-700 dark:text-green-400">Coverage: ${apiCoverage}%</span>
                        <div class="w-24 bg-green-200 rounded-full h-2">
                            <div class="bg-green-600 h-2 rounded-full" style="width: ${apiCoverage}%"></div>
                        </div>
                    </div>
                </div>
            `;
        }

        if (hasSecurityDocs) {
            const securityCoverage = this.technologyData.security_documentation_coverage;
            statusContent += `
                <div class="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                    <h4 class="font-semibold text-blue-900 dark:text-blue-300 mb-2">Security Documentation</h4>
                    <div class="flex justify-between items-center">
                        <span class="text-sm text-blue-700 dark:text-blue-400">Coverage: ${securityCoverage}%</span>
                        <div class="w-24 bg-blue-200 rounded-full h-2">
                            <div class="bg-blue-600 h-2 rounded-full" style="width: ${securityCoverage}%"></div>
                        </div>
                    </div>
                </div>
            `;
        }

        if (hasPlatformDocs) {
            const platformCoverage = this.technologyData.platform_documentation_coverage;
            statusContent += `
                <div class="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-700">
                    <h4 class="font-semibold text-yellow-900 dark:text-yellow-300 mb-2">Platform Guides</h4>
                    <div class="flex justify-between items-center">
                        <span class="text-sm text-yellow-700 dark:text-yellow-400">Coverage: ${platformCoverage}%</span>
                        <div class="w-24 bg-yellow-200 rounded-full h-2">
                            <div class="bg-yellow-600 h-2 rounded-full" style="width: ${platformCoverage}%"></div>
                        </div>
                    </div>
                </div>
            `;
        }

        container.innerHTML = statusContent;
    }

    setupEventListeners() {
        // Theme toggle
        if (this.utils && typeof this.utils.setupThemeToggle === 'function') {
            this.utils.setupThemeToggle();
        } else {
            console.warn('Utils setupThemeToggle method not available');
        }

        // Sidebar toggle
        if (this.utils && typeof this.utils.setupSidebarToggle === 'function') {
            this.utils.setupSidebarToggle();
        } else {
            console.warn('Utils setupSidebarToggle method not available');
        }

        // Refresh data button
        document.getElementById('refreshData')?.addEventListener('click', () => {
            this.initialize();
        });
    }

    showError(message) {
        document.getElementById('loadingIndicator').innerHTML = `
            <div class="flex items-center justify-center py-12">
                <div class="text-center">
                    <i class="fas fa-exclamation-triangle text-4xl text-red-500 mb-4"></i>
                    <p class="text-gray-600 dark:text-gray-400">${message}</p>
                </div>
            </div>
        `;
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Ensure utils are available before initializing
    function initializeDashboard() {
        if (window.analyticsUtils) {
            window.knowledgeDashboard = new KnowledgeDashboard();
            window.knowledgeDashboard.initialize();
        } else {
            // Wait a bit and try again
            setTimeout(initializeDashboard, 50);
        }
    }
    
    initializeDashboard();
});