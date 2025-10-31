/**
 * Technology Stack Analysis Dashboard
 * Handles technology usage analytics, trends, and stack insights
 */

class TechnologyDashboard {
    constructor() {
        this.isInitialized = false;
        this.technologyData = null;
        this.charts = new Map();
        this.utils = window.analyticsUtils;
    }

    async init() {
        if (this.isInitialized) return;
        
        console.log('Initializing Technology Dashboard...');
        
        try {
            // Show loading state
            this.utils.showLoading();
            
            // Load technology data
            await this.loadTechnologyData();
            
            // Initialize charts and metrics
            await this.initializeCharts();
            await this.updateMetrics();
            await this.updateTechnologyInsights();
            
            // Hide loading and show content
            this.utils.hideLoading();
            
            // Setup event listeners
            this.setupEventListeners();
            
            this.isInitialized = true;
            console.log('Technology Dashboard initialized successfully');
            
        } catch (error) {
            console.error('Error initializing technology dashboard:', error);
            this.utils.showError('Failed to initialize technology dashboard. Please refresh the page.');
        }
    }

    async loadTechnologyData() {
        console.log('🔧 Loading technology stack data...');
        this.technologyData = await this.utils.loadTechnologyStack();
        
        console.log('🔧 Technology data loaded:', {
            hasData: !!this.technologyData,
            hasOverallUsage: !!(this.technologyData?.overall_technology_usage),
            hasByCategory: !!(this.technologyData?.technology_by_category),
            totalTechnologies: Object.keys(this.technologyData?.overall_technology_usage || {}).length,
            categories: Object.keys(this.technologyData?.technology_by_category || {})
        });
        
        if (!this.technologyData) {
            throw new Error('Failed to load technology stack data');
        }
    }

    async initializeCharts() {
        console.log('Initializing technology charts...');
        
        const chartPromises = [
            this.createTechnologyUsageChart(),
            this.createTechnologyTimelineChart(),
            this.createTechnologyComparisonChart(),
            this.createTechnologyCategoryChart()
        ];

        await Promise.all(chartPromises);
        console.log('All technology charts initialized');
    }

    async createTechnologyUsageChart() {
        if (!this.technologyData) return;

        const { labels, series } = this.processTechnologyDistributionData();
        
        const options = {
            series: [{
                name: 'Usage Count',
                data: series
            }],
            chart: {
                type: 'bar',
                height: 350,
                toolbar: { show: false }
            },
            colors: ['#3B82F6'],
            plotOptions: {
                bar: {
                    horizontal: false,
                    borderRadius: 4,
                    dataLabels: { position: 'top' }
                }
            },
            dataLabels: {
                enabled: true,
                formatter: function(val) {
                    return window.analyticsUtils.formatNumber(val);
                }
            },
            xaxis: {
                categories: labels,
                labels: {
                    style: { fontSize: '12px' }
                }
            },
            yaxis: {
                labels: {
                    formatter: function(val) {
                        return window.analyticsUtils.formatNumber(val);
                    }
                }
            },
            title: {
                text: 'Top Technologies by Usage',
                align: 'center'
            }
        };

        const chartElement = document.getElementById('technologyUsageChart');
        if (chartElement) {
            const chart = new ApexCharts(chartElement, options);
            await chart.render();
            this.charts.set('technologyUsage', chart);
        }
    }

    async createTechnologyTimelineChart() {
        if (!this.technologyData) return;

        const { categories, series } = this.processTechnologyTimelineData();
        
        const options = {
            series: series,
            chart: {
                type: 'line',
                height: 350,
                toolbar: { show: false }
            },
            colors: ['#06B6D4'],
            stroke: {
                curve: 'smooth',
                width: 3
            },
            xaxis: {
                categories: categories,
                labels: {
                    style: { fontSize: '12px' }
                }
            },
            yaxis: {
                labels: {
                    formatter: function(val) {
                        return window.analyticsUtils.formatNumber(val);
                    }
                }
            },
            title: {
                text: 'Technology Usage Trends',
                align: 'center'
            },
            markers: {
                size: 6,
                colors: ['#06B6D4'],
                strokeColors: '#fff',
                strokeWidth: 2
            }
        };

        const chartElement = document.getElementById('technologyTimelineChart');
        if (chartElement) {
            const chart = new ApexCharts(chartElement, options);
            await chart.render();
            this.charts.set('technologyTimeline', chart);
        }
    }

    async createTechnologyComparisonChart() {
        if (!this.technologyData) return;

        const { categories, series } = this.processTechnologyComparisonData();
        
        const options = {
            series: series,
            chart: {
                type: 'bar',
                height: 400,
                stacked: false,
                toolbar: { show: false }
            },
            colors: ['#3B82F6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'],
            plotOptions: {
                bar: {
                    horizontal: false,
                    borderRadius: 4
                }
            },
            xaxis: {
                categories: categories,
                labels: {
                    style: { fontSize: '12px' }
                }
            },
            yaxis: {
                labels: {
                    formatter: function(val) {
                        return window.analyticsUtils.formatNumber(val);
                    }
                }
            },
            title: {
                text: 'Technology Usage by Category',
                align: 'center'
            },
            legend: {
                position: 'top'
            }
        };

        const chartElement = document.getElementById('technologyComparisonChart');
        if (chartElement) {
            const chart = new ApexCharts(chartElement, options);
            await chart.render();
            this.charts.set('technologyComparison', chart);
        }
    }

    async createTechnologyCategoryChart() {
        if (!this.technologyData) return;

        const { labels, series } = this.processTechnologyCategoryData();
        
        const options = {
            series: series,
            chart: {
                type: 'donut',
                height: 350
            },
            colors: ['#3B82F6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'],
            labels: labels,
            title: {
                text: 'Technology Categories Distribution',
                align: 'center'
            },
            legend: {
                position: 'bottom'
            },
            dataLabels: {
                enabled: true,
                formatter: function(val) {
                    return val.toFixed(1) + '%';
                }
            }
        };

        const chartElement = document.getElementById('technologyCategoryChart');
        if (chartElement) {
            const chart = new ApexCharts(chartElement, options);
            await chart.render();
            this.charts.set('technologyCategory', chart);
        }
    }

    processTechnologyDistributionData() {
        const labels = [];
        const series = [];
        
        // Use overall technology usage data
        const techUsage = this.technologyData.overall_technology_usage || {};
        
        // Sort and take top 8
        const sortedTech = Object.entries(techUsage)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 8);

        sortedTech.forEach(([tech, count]) => {
            labels.push(tech.toUpperCase());
            series.push(count);
        });

        return { labels, series };
    }

    processTechnologyTimelineData() {
        const categories = [];
        const data = [];

        // Use technology by category for timeline view
        const techByCategory = this.technologyData.technology_by_category || {};
        
        // Get top technologies from all categories
        const allTechs = {};
        Object.values(techByCategory).forEach(categoryTechs => {
            Object.entries(categoryTechs).forEach(([tech, count]) => {
                allTechs[tech] = (allTechs[tech] || 0) + count;
            });
        });
        
        // Sort and take top 10
        const topTechs = Object.entries(allTechs)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10);

        topTechs.forEach(([tech, count]) => {
            categories.push(tech.toUpperCase());
            data.push(count);
        });

        return {
            categories,
            series: [{
                name: 'Usage Count',
                data: data
            }]
        };
    }

    processTechnologyComparisonData() {
        const categories = [];
        const seriesData = [];

        // Get technology by category for comparison
        const techByCategory = this.technologyData.technology_by_category || {};
        
        // Get top categories and their top technologies
        const topCategories = Object.entries(techByCategory)
            .sort(([,a], [,b]) => {
                const sumA = Object.values(a).reduce((sum, val) => sum + val, 0);
                const sumB = Object.values(b).reduce((sum, val) => sum + val, 0);
                return sumB - sumA;
            })
            .slice(0, 6); // Top 6 categories

        // Get all technologies across categories for consistent categories
        const allTechs = new Set();
        topCategories.forEach(([, techs]) => {
            Object.keys(techs).forEach(tech => allTechs.add(tech));
        });
        
        const topTechs = Array.from(allTechs).slice(0, 8); // Top 8 technologies
        topTechs.forEach(tech => categories.push(tech.toUpperCase()));

        topCategories.forEach(([categoryName, techs]) => {
            const categoryData = [];
            
            categories.forEach(tech => {
                const techKey = tech.toLowerCase();
                categoryData.push(techs[techKey] || 0);
            });
            
            seriesData.push({
                name: categoryName.charAt(0).toUpperCase() + categoryName.slice(1),
                data: categoryData
            });
        });

        return {
            categories,
            series: seriesData
        };
    }

    processTechnologyCategoryData() {
        const labels = [];
        const series = [];
        
        const techByCategory = this.technologyData.technology_by_category || {};
        
        Object.entries(techByCategory).forEach(([category, techs]) => {
            const totalUsage = Object.values(techs).reduce((sum, count) => sum + count, 0);
            if (totalUsage > 0) {
                labels.push(category.charAt(0).toUpperCase() + category.slice(1));
                series.push(totalUsage);
            }
        });

        return { labels, series };
    }

    updateMetrics() {
        if (!this.technologyData) return;

        const metrics = this.calculateTechnologyMetrics();
        
        // Update primary language
        const primaryLanguageEl = document.getElementById('primaryLanguage');
        if (primaryLanguageEl) {
            primaryLanguageEl.textContent = metrics.primaryLanguage;
        }
        
        const primaryLanguageUsageEl = document.getElementById('primaryLanguageUsage');
        if (primaryLanguageUsageEl) {
            primaryLanguageUsageEl.innerHTML = `<i class="fas fa-chart-bar mr-1"></i>${window.analyticsUtils.formatNumber(metrics.primaryLanguageUsage)} commits`;
        }

        // Update security tech count
        const securityTechCountEl = document.getElementById('securityTechCount');
        if (securityTechCountEl) {
            securityTechCountEl.textContent = metrics.securityTechCount;
        }
        
        const securityUsageEl = document.getElementById('securityUsage');
        if (securityUsageEl) {
            securityUsageEl.innerHTML = `<i class="fas fa-lock mr-1"></i>${window.analyticsUtils.formatNumber(metrics.securityUsage)} total usage`;
        }

        // Update network tech count
        const networkTechCountEl = document.getElementById('networkTechCount');
        if (networkTechCountEl) {
            networkTechCountEl.textContent = metrics.networkTechCount;
        }
        
        const networkUsageEl = document.getElementById('networkUsage');
        if (networkUsageEl) {
            networkUsageEl.innerHTML = `<i class="fas fa-globe mr-1"></i>${window.analyticsUtils.formatNumber(metrics.networkUsage)} total usage`;
        }

        // Update platform count
        const platformCountEl = document.getElementById('platformCount');
        if (platformCountEl) {
            platformCountEl.textContent = metrics.platformCount;
        }
        
        const platformUsageEl = document.getElementById('platformUsage');
        if (platformUsageEl) {
            platformUsageEl.innerHTML = `<i class="fas fa-server mr-1"></i>${window.analyticsUtils.formatNumber(metrics.platformUsage)} total usage`;
        }
    }

    calculateTechnologyMetrics() {
        const techUsage = this.technologyData.overall_technology_usage || {};
        const techByCategory = this.technologyData.technology_by_category || {};
        
        // Primary language
        const topTech = Object.entries(techUsage)
            .sort(([,a], [,b]) => b - a)[0];
        const primaryLanguage = topTech ? topTech[0].toUpperCase() : 'N/A';
        const primaryLanguageUsage = topTech ? topTech[1] : 0;
        
        // Security technologies
        const securityTechs = techByCategory.security || {};
        const securityTechCount = Object.keys(securityTechs).length;
        const securityUsage = Object.values(securityTechs).reduce((sum, count) => sum + count, 0);
        
        // Network technologies
        const networkTechs = techByCategory.networking || techByCategory.web || {};
        const networkTechCount = Object.keys(networkTechs).length;
        const networkUsage = Object.values(networkTechs).reduce((sum, count) => sum + count, 0);
        
        // Platform technologies
        const platformTechs = techByCategory.platforms || {};
        const platformCount = Object.keys(platformTechs).length;
        const platformUsage = Object.values(platformTechs).reduce((sum, count) => sum + count, 0);

        return {
            primaryLanguage,
            primaryLanguageUsage,
            securityTechCount,
            securityUsage,
            networkTechCount,
            networkUsage,
            platformCount,
            platformUsage
        };
    }

    updateTechnologyInsights() {
        if (!this.technologyData) return;

        const insights = this.generateTechnologyInsights();
        
        const insightsContainer = document.getElementById('technologyInsights');
        if (insightsContainer) {
            insightsContainer.innerHTML = insights.map(insight => `
                <div class="insight-item p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div class="flex items-start">
                        <i class="${insight.icon} text-blue-600 mt-1 mr-3"></i>
                        <div>
                            <h4 class="font-semibold text-gray-900 dark:text-white">${insight.title}</h4>
                            <p class="text-sm text-gray-600 dark:text-gray-300">${insight.description}</p>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    }

    generateTechnologyInsights() {
        const techUsage = this.technologyData.overall_technology_usage || {};
        const techByCategory = this.technologyData.technology_by_category || {};
        const insights = [];

        // Technology diversity insight
        const totalTechs = Object.keys(techUsage).length;
        insights.push({
            icon: 'fas fa-layer-group',
            title: 'Technology Stack Diversity',
            description: `Using ${totalTechs} different technologies across ${Object.keys(techByCategory).length} categories.`
        });

        // Security focus insight
        const securityTechs = techByCategory.security || {};
        if (Object.keys(securityTechs).length > 0) {
            insights.push({
                icon: 'fas fa-shield-alt',
                title: 'Security Technology Focus',
                description: `Strong emphasis on security with ${Object.keys(securityTechs).length} security technologies actively used.`
            });
        }

        // Language diversity
        const languages = techByCategory.languages || {};
        if (Object.keys(languages).length > 0) {
            insights.push({
                icon: 'fas fa-code',
                title: 'Multi-Language Development',
                description: `Development across ${Object.keys(languages).length} programming languages, promoting versatility.`
            });
        }

        return insights;
    }

    setupEventListeners() {
        // Refresh button
        const refreshBtn = document.getElementById('refreshTechnology');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                // Clear cache and reload data
                this.utils.clearCache();
                await this.loadTechnologyData();
                
                // Destroy existing charts
                this.charts.forEach(chart => chart.destroy());
                this.charts.clear();
                
                // Reinitialize
                await this.initializeCharts();
                await this.updateMetrics();
                await this.updateTechnologyInsights();
            });
        }

        // Filter refresh
        window.refreshDashboard = async () => {
            if (this.isInitialized) {
                try {
                    console.log('📊 Loading technology data with filters...');
                    await this.loadTechnologyData();
                    console.log('✅ Technology data loaded successfully');
                    
                    // Destroy existing charts
                    this.charts.forEach(chart => chart.destroy());
                    this.charts.clear();
                    
                    await this.initializeCharts();
                    await this.updateMetrics();
                    await this.updateTechnologyInsights();
                    
                    console.log('✅ Technology dashboard refreshed');
                } catch (error) {
                    console.error('❌ Error refreshing technology dashboard:', error);
                    this.utils.showError('Failed to refresh technology data');
                }
            }
        };
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    const dashboard = new TechnologyDashboard();
    await dashboard.init();
});
