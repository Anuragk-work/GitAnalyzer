class RegionalDashboard {
    constructor() {
        this.regionalData = null;
        this.charts = new Map();
        this.utils = window.analyticsUtils;
        
        // Define known/valid regions for consistent filtering
        this.knownRegions = [
            'China', 'United States', 'India', 'Canada', 'United Kingdom', 
            'Germany', 'France', 'Japan', 'Australia', 'Brazil', 'Russia', 
            'South Korea', 'Netherlands', 'Sweden', 'Switzerland', 'Italy', 
            'Spain', 'Norway'
        ];
    }

    async initialize() {
        try {
            await this.loadRegionalData();
            await this.initializeCharts();
            await this.updateMetrics();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Show dashboard content
            document.getElementById('loadingIndicator').classList.add('hidden');
            document.getElementById('dashboardContent').classList.remove('hidden');
            
            // Update timestamp
            this.utils.updateTimestamp();
            
        } catch (error) {
            console.error('Error initializing regional dashboard:', error);
            this.showError('Failed to load regional analytics data');
        }
    }

    async loadRegionalData() {
        this.regionalData = await this.utils.loadRegionalAnalysis();
        console.log('Loaded regional data:', this.regionalData);
    }

    async initializeCharts() {
        const chartPromises = [
            this.createGlobalDeveloperMap(),
            this.createRegionalContributionChart(),
            this.createRegionalTimelineChart()
        ];

        await Promise.allSettled(chartPromises);
        console.log('Regional charts initialization completed');
    }

    async createGlobalDeveloperMap() {
        const container = document.getElementById('globalDeveloperMap');
        console.log('🗺️ Creating global developer map...', { 
            container: !!container, 
            regionalData: !!this.regionalData,
            regionalDataContent: this.regionalData 
        });
        
        if (!container) {
            console.error('❌ Container not found for globalDeveloperMap');
            return;
        }
        
        if (!this.regionalData) {
            console.error('❌ Regional data not available');
            container.innerHTML = '<div class="flex items-center justify-center h-full text-gray-500">No regional data available</div>';
            return;
        }

        try {
            // Clear any existing map
            container.innerHTML = '';
            
            // Check if Leaflet is available
            if (typeof L === 'undefined') {
                console.error('❌ Leaflet.js is not loaded');
                container.innerHTML = '<div class="flex items-center justify-center h-full text-gray-500">Map library not loaded</div>';
                return;
            }
            
            console.log('🗺️ Initializing Leaflet map...');
            
            // Create Leaflet map
            const map = L.map(container, {
                center: [30.0, 0.0],
                zoom: 2,
                zoomControl: true,
                scrollWheelZoom: true
            });
            
            console.log('🗺️ Map initialized, adding tile layer...');

            // Add tile layer
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 18
            }).addTo(map);

            // Add regional markers
            console.log('🗺️ Processing regional data for markers...');
            console.log('Utils object:', this.utils);
            console.log('Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(this.utils)));
            const regionLocations = this.utils.getGlobalDevelopmentLocations();
            console.log('🗺️ Region locations:', regionLocations);
            
            if (!this.regionalData.regional_breakdown) {
                console.warn('⚠️ No regional_breakdown found in regional data');
                container.innerHTML = '<div class="flex items-center justify-center h-full text-gray-500">No regional breakdown data available</div>';
                return;
            }
            
            console.log('🗺️ Regional breakdown data:', this.regionalData.regional_breakdown);
            
            // Use the class-defined known regions

             let markersAdded = 0;
            if (this.regionalData.regional_breakdown) {
                Object.entries(this.regionalData.regional_breakdown).forEach(([regionName, data]) => {
                    const location = regionLocations[regionName];
                    const developers = data.developers_count || data.unique_developers || 0;
                    const commits = data.commits || data.total_commits || 0;
                    
                    console.log(`🗺️ Processing region: ${regionName}`, { 
                        developers, 
                        commits, 
                        location: !!location,
                        locationData: location,
                        isKnownRegion: this.knownRegions.includes(regionName)
                    });
                    
                    // Only add markers for known regions with developers
                    if (location && developers > 0 && this.knownRegions.includes(regionName)) {
                        console.log(`🗺️ Adding marker for ${regionName}: ${developers} developers, ${commits} commits`);
                        
                        const size = Math.max(10, Math.min(40, developers * 0.3));
                        
                        const marker = L.circleMarker([location.lat, location.lng], {
                            radius: size,
                            fillColor: location.color,
                            color: '#fff',
                            weight: 2,
                            opacity: 1,
                            fillOpacity: 0.7
                        }).addTo(map);
                        
                        markersAdded++;

                        marker.bindPopup(`
                            <div class="p-2">
                                <h4 class="font-semibold text-lg">${this.utils.getRegionFlag(regionName)} ${regionName}</h4>
                                <p class="text-sm mt-1">
                                    <strong>${developers.toLocaleString()}</strong> developers<br>
                                    <strong>${commits.toLocaleString()}</strong> commits
                                </p>
                            </div>
                        `);
                    } else if (!location) {
                        console.warn(`⚠️ No location found for region: ${regionName}`);
                    } else if (developers === 0) {
                        console.warn(`⚠️ No developers found for region: ${regionName}`);
                    }
                });
            }

            console.log(`🗺️ Added ${markersAdded} markers to map`);

            this.charts.set('globalDeveloperMap', map);

            // Force map resize after a short delay to ensure proper rendering
            setTimeout(() => {
                map.invalidateSize();
                console.log('🗺️ Map size invalidated for proper rendering');
            }, 100);

            console.log('✅ Global developer map created successfully with', markersAdded, 'markers');

        } catch (error) {
            console.error('❌ Error creating global developer map:', error);
            container.innerHTML = `<div class="flex items-center justify-center h-full text-gray-500">
                <div class="text-center">
                    <i class="fas fa-exclamation-triangle text-4xl text-red-500 mb-4"></i>
                    <p>Error loading map</p>
                    <p class="text-sm text-red-600">${error.message}</p>
                </div>
            </div>`;
        }
    }

    async createRegionalContributionChart() {
        const container = document.getElementById('regionalContributionChart');
        if (!container || !this.regionalData) return;

        try {
            const chartData = this.utils.processDeveloperDistributionData(this.regionalData);

            const options = {
                series: chartData.data,
                chart: {
                    type: 'donut',
                    height: '100%'
                },
                labels: chartData.labels,
                colors: ['#DC2626', '#2563EB', '#EA580C', '#7C3AED', '#6B7280'],
                legend: {
                    position: 'bottom',
                    fontSize: '14px'
                },
                dataLabels: {
                    enabled: true,
                    formatter: function (val) {
                        return Math.round(val) + '%';
                    }
                },
                plotOptions: {
                    pie: {
                        donut: {
                            size: '70%'
                        }
                    }
                }
            };

            const chart = new ApexCharts(container, options);
            await chart.render();
            this.charts.set('regionalContributionChart', chart);

        } catch (error) {
            console.error('Error creating regional contribution chart:', error);
            container.innerHTML = '<div class="flex items-center justify-center h-full text-gray-500">Error loading chart data</div>';
        }
    }

    async createRegionalTimelineChart() {
        const container = document.getElementById('regionalTimelineChart');
        if (!container) return;

        try {
            // This would need yearly regional data to show trends
            container.innerHTML = `
                <div class="flex items-center justify-center h-64 text-gray-500">
                    <div class="text-center">
                        <i class="fas fa-chart-line text-4xl mb-4"></i>
                        <p>Regional timeline analysis will be displayed here</p>
                        <p class="text-sm mt-2">Requires yearly regional data aggregation</p>
                    </div>
                </div>
            `;

        } catch (error) {
            console.error('Error creating regional timeline chart:', error);
        }
    }

    async updateMetrics() {
        if (!this.regionalData) return;

        try {
            // Use the class-defined known regions

            // Count only known regions with developers
            const activeKnownRegions = Object.entries(this.regionalData.regional_breakdown || {})
                .filter(([regionName, data]) => {
                    const developers = data.developers_count || data.unique_developers || 0;
                    return this.knownRegions.includes(regionName) && developers > 0;
                }).length;

            // Total regions (only known ones)
            document.getElementById('totalRegions').textContent = activeKnownRegions || '--';

            // Top region (only from known regions)
            const topRegion = this.getTopRegion(this.knownRegions);
            document.getElementById('topRegion').textContent = topRegion.name || '--';
            document.getElementById('topRegionStats').innerHTML = 
                `<i class="fas fa-users mr-1"></i>${topRegion.developers || '--'} developers`;

            // Cross-regional commits (calculated from known regions only)
            const totalCommits = this.getTotalCommits(this.knownRegions);
            document.getElementById('crossRegionalCommits').textContent = totalCommits.toLocaleString();

            // Diversity index (simplified calculation for known regions only)
            const diversityIndex = this.calculateDiversityIndex(this.knownRegions);
            document.getElementById('diversityIndex').textContent = diversityIndex;

            // Regional statistics
            this.updateRegionalStatistics();
            this.updateRegionalTrends();

            console.log(`📊 Updated metrics for ${activeKnownRegions} known regions`);

        } catch (error) {
            console.error('Error updating regional metrics:', error);
        }
    }

    getTopRegion(knownRegions = []) {
        if (!this.regionalData.regional_breakdown) return { name: '--', developers: '--' };

        let topRegion = { name: '--', developers: 0 };
        Object.entries(this.regionalData.regional_breakdown).forEach(([name, data]) => {
            const developers = data.developers_count || data.unique_developers || 0;
            
            // Only consider known regions if filter is provided
            const isValidRegion = knownRegions.length === 0 || knownRegions.includes(name);
            
            if (isValidRegion && developers > topRegion.developers) {
                topRegion = { name, developers };
            }
        });

        return topRegion;
    }

    getTotalCommits(knownRegions = []) {
        if (!this.regionalData.regional_breakdown) return 0;

        return Object.entries(this.regionalData.regional_breakdown)
            .filter(([regionName]) => knownRegions.length === 0 || knownRegions.includes(regionName))
            .reduce((total, [, data]) => total + (data.commits || data.total_commits || 0), 0);
    }

    calculateDiversityIndex(knownRegions = []) {
        if (!this.regionalData.regional_breakdown) return '--';

        // Filter regions based on known regions list
        const filteredRegions = Object.entries(this.regionalData.regional_breakdown)
            .filter(([regionName]) => knownRegions.length === 0 || knownRegions.includes(regionName))
            .map(([, data]) => data);

        const totalDevs = filteredRegions.reduce((sum, data) => sum + (data.developers_count || data.unique_developers || 0), 0);
        
        if (totalDevs === 0) return '--';

        // Simpson's diversity index (simplified)
        let diversitySum = 0;
        filteredRegions.forEach(data => {
            const devs = data.developers_count || data.unique_developers || 0;
            const proportion = devs / totalDevs;
            diversitySum += proportion * proportion;
        });

        const diversity = (1 - diversitySum) * 100;
        return `${Math.round(diversity)}%`;
    }

    updateRegionalStatistics() {
        const container = document.getElementById('regionalStatistics');
        if (!container || !this.regionalData.regional_breakdown) return;

        // Use the class-defined known regions

        let html = '';
        let knownRegionCount = 0;
        
        Object.entries(this.regionalData.regional_breakdown).forEach(([regionName, data]) => {
            const developers = data.developers_count || data.unique_developers || 0;
            const commits = data.commits || data.total_commits || 0;
            
            // Only show known regions with developers
            if (developers > 0 && this.knownRegions.includes(regionName)) {
                knownRegionCount++;
                html += `
                    <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div class="flex items-center">
                            <span class="text-lg mr-3">${this.utils.getRegionFlag(regionName)}</span>
                            <div>
                                <h4 class="font-semibold text-gray-900 dark:text-white">${regionName}</h4>
                                <p class="text-sm text-gray-600 dark:text-gray-400">${developers} developers</p>
                            </div>
                        </div>
                        <div class="text-right">
                            <p class="font-semibold text-gray-900 dark:text-white">${commits.toLocaleString()}</p>
                            <p class="text-sm text-gray-600 dark:text-gray-400">commits</p>
                        </div>
                    </div>
                `;
            }
        });

        console.log(`📊 Displaying statistics for ${knownRegionCount} known regions`);
        container.innerHTML = html || '<p class="text-gray-500">No regional data available</p>';
    }

    updateRegionalTrends() {
        const container = document.getElementById('regionalTrends');
        if (!container) return;

        // Use the class-defined known regions

        // Generate trends based on known regions only
        const filteredEntries = Object.entries(this.regionalData.regional_breakdown || {})
            .filter(([regionName, data]) => {
                const developers = data.developers_count || data.unique_developers || 0;
                return this.knownRegions.includes(regionName) && developers > 0;
            });

        const regions = filteredEntries.length;
        const totalDevs = filteredEntries
            .reduce((sum, [, data]) => sum + (data.developers_count || data.unique_developers || 0), 0);

        container.innerHTML = `
            <div class="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                <h4 class="font-semibold text-blue-900 dark:text-blue-300 mb-2">Global Distribution</h4>
                <p class="text-sm text-blue-700 dark:text-blue-400">Development activity spans ${regions} known regions with ${totalDevs.toLocaleString()} developers.</p>
            </div>
            <div class="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
                <h4 class="font-semibold text-green-900 dark:text-green-300 mb-2">Regional Collaboration</h4>
                <p class="text-sm text-green-700 dark:text-green-400">Cross-regional development patterns indicate strong global collaboration across identified geographic regions.</p>
            </div>
        `;
    }

    setupEventListeners() {
        // Apply filters button
        document.getElementById('applyFilters')?.addEventListener('click', () => {
            this.applyFilters();
        });

        // Theme toggle
        this.utils.setupThemeToggle();

        // Sidebar toggle
        this.utils.setupSidebarToggle();
    }

    async applyFilters() {
        try {
            // Safely get filter elements with null checks
            const projectElement = document.getElementById('projectFilter');
            const yearElement = document.getElementById('yearFilter');
            
            if (!projectElement) {
                console.error('projectFilter element not found in DOM');
                return;
            }
            
            const project = projectElement.value || '';
            const year = yearElement ? (yearElement.value || '') : '';
            
            console.log('Applying filters:', { project, year });
            
            // Update current filters
            if (this.utils && this.utils.currentFilters) {
                this.utils.currentFilters.project = project;
                if (year) {
                    this.utils.currentFilters.year = year;
                }
            }
            
            // Reload data and refresh charts
            await this.loadRegionalData();
            
            // Destroy existing charts
            this.charts.forEach((chart, key) => {
                try {
                    if (key === 'globalDeveloperMap' && chart && typeof chart.remove === 'function') {
                        chart.remove();
                    } else if (chart && typeof chart.destroy === 'function') {
                        chart.destroy();
                    }
                } catch (chartError) {
                    console.warn(`Error destroying chart ${key}:`, chartError);
                }
            });
            this.charts.clear();
            
            await this.initializeCharts();
            await this.updateMetrics();
        } catch (error) {
            console.error('Error applying filters:', error);
            this.showError('Failed to apply filters. Please try again.');
        }
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
    window.regionalDashboard = new RegionalDashboard();
    window.regionalDashboard.initialize();
});