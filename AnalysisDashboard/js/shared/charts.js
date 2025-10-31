/**
 * Analytics Dashboard - Chart Management
 * Handles creation and management of all dashboard charts and visualizations
 */

class AnalyticsCharts {
    constructor() {
        this.charts = new Map();
        this.mapInstance = null;
        this.mapContainers = new Set(); // Track map containers
        this.initializeChartDefaults();
    }

    initializeChartDefaults() {
        // Chart.js global defaults
        if (typeof Chart !== 'undefined') {
            Chart.defaults.font.family = 'Inter, sans-serif';
            Chart.defaults.color = '#6B7280';
            Chart.defaults.plugins.legend.position = 'bottom';
            Chart.defaults.responsive = true;
            Chart.defaults.maintainAspectRatio = false;
        }

        // ApexCharts global defaults
        if (typeof ApexCharts !== 'undefined') {
            ApexCharts.globalOptions = {
                chart: {
                    fontFamily: 'Inter, sans-serif',
                    toolbar: { show: false },
                    animations: {
                        enabled: true,
                        easing: 'easeinout',
                        speed: 800
                    }
                },
                colors: ['#1E40AF', '#DC2626', '#059669', '#7C3AED', '#EA580C', '#DB2777', '#0F766E', '#1D4ED8'],
                dataLabels: {
                    enabled: false
                },
                legend: {
                    position: 'bottom',
                    fontSize: '14px'
                }
            };
        }
    }

    /**
     * Repository Development Timeline Chart - Multi-line chart showing development progress for each repository
     */
    async createCommitTimelineChart(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        try {
            // Load repository-specific data
            const repositoryTimeline = await this.loadRepositoryTimelineData();
            if (!repositoryTimeline || repositoryTimeline.length === 0) {
                container.innerHTML = '<div class="flex items-center justify-center h-full text-gray-500">No repository data available</div>';
                return;
            }

            // Extract years dynamically from repository data - NO HARDCODED YEARS
            // Collect all unique years from all repository series
            const allYearsSet = new Set();
            repositoryTimeline.forEach(series => {
                if (series.yearCategories && Array.isArray(series.yearCategories)) {
                    series.yearCategories.forEach(year => allYearsSet.add(year));
                }
            });
            
            // Convert to sorted array
            let yearCategories = Array.from(allYearsSet).sort((a, b) => parseInt(a) - parseInt(b));
            
            // If no years found, use fallback: get from first commit dates
            if (yearCategories.length === 0 && repositoryTimeline.length > 0) {
                const firstYears = repositoryTimeline
                    .map(s => parseInt(s.metadata?.firstCommitDate || '2023'))
                    .filter(y => !isNaN(y));
                
                if (firstYears.length > 0) {
                    const minYear = Math.min(...firstYears);
                    const maxYear = new Date().getFullYear();
                    yearCategories = [];
                    for (let y = minYear; y <= maxYear; y++) {
                        yearCategories.push(y.toString());
                    }
                }
            }
            
            // Align all series data to use the same year categories
            // Pad or trim series data to match yearCategories length
            const alignedSeries = repositoryTimeline.map(series => {
                const alignedData = new Array(yearCategories.length).fill(0);
                if (series.yearCategories && series.data) {
                    series.yearCategories.forEach((year, idx) => {
                        const targetIdx = yearCategories.indexOf(year);
                        if (targetIdx >= 0 && series.data[idx] !== undefined) {
                            // Use cumulative value from original data
                            alignedData[targetIdx] = series.data[idx];
                            // Fill gaps with previous value (cumulative)
                            if (targetIdx > 0 && alignedData[targetIdx] === 0) {
                                alignedData[targetIdx] = alignedData[targetIdx - 1];
                            }
                        }
                    });
                    
                    // Fill remaining cumulative values
                    for (let i = 1; i < alignedData.length; i++) {
                        if (alignedData[i] === 0) {
                            alignedData[i] = alignedData[i - 1];
                        }
                    }
                }
                return {
                    name: series.name,
                    data: alignedData,
                    metadata: series.metadata
                };
            });

            const options = {
                series: alignedSeries,
                chart: {
                    type: 'line',
                    height: '100%',
                    toolbar: { show: false },
                    zoom: { enabled: true },
                    animations: {
                        enabled: true,
                        easing: 'easeinout',
                        speed: 800
                    }
                },
                stroke: {
                    width: 3,
                    curve: 'smooth'
                },
                xaxis: {
                    type: 'category',
                    categories: yearCategories,
                    labels: {
                        style: {
                            fontSize: '12px'
                        }
                    },
                    title: {
                        text: 'Year',
                        style: {
                            fontSize: '14px',
                            fontWeight: 600
                        }
                    }
                },
                yaxis: {
                    title: {
                        text: 'Cumulative Commits',
                        style: {
                            fontSize: '14px',
                            fontWeight: 600
                        }
                    },
                    labels: {
                        formatter: function(value) {
                            return Math.round(value).toLocaleString();
                        }
                    }
                },
                colors: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#F97316', '#06B6D4'],
                legend: {
                    show: true,
                    position: 'top',
                    horizontalAlign: 'left',
                    fontSize: '12px',
                    fontWeight: 600
                },
                grid: {
                    show: true,
                    borderColor: '#E5E7EB',
                    strokeDashArray: 5
                },
                markers: {
                    size: 5,
                    strokeWidth: 2,
                    strokeColors: '#fff',
                    hover: {
                        size: 7
                    }
                },
                tooltip: {
                    enabled: true,
                    shared: false,
                    intersect: false,
                    custom: function({ series, seriesIndex, dataPointIndex, w }) {
                        const repoName = w.config.series[seriesIndex].name;
                        // Fix: Get year from categories array correctly
                        const yearCategories = w.config.xaxis.categories || [];
                        const year = yearCategories[dataPointIndex] || 'Unknown';
                        const commits = series[seriesIndex][dataPointIndex] || 0;
                        
                        // Get repository metadata for tooltip
                        const repoData = w.config.series[seriesIndex]?.metadata || w.config.series[seriesIndex]?.metadata || {};
                        const totalCommits = repoData.totalCommits || 0;
                        const topContributor = repoData.topContributor || 'N/A';
                        const mostModifiedFile = repoData.mostModifiedFile || 'N/A';
                        const firstCommitDate = repoData.firstCommitDate || 'N/A';
                        
                        // Calculate commits for this specific year (cumulative - previous cumulative)
                        const previousCommits = dataPointIndex > 0 ? (series[seriesIndex][dataPointIndex - 1] || 0) : 0;
                        const yearCommits = commits - previousCommits;
                        
                        return `
                            <div class="custom-tooltip" style="padding: 12px; background: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border: 1px solid #E5E7EB;">
                                <div style="font-weight: 600; color: #111827; margin-bottom: 8px; border-bottom: 1px solid #E5E7EB; padding-bottom: 6px;">
                                    📁 ${repoName}
                                </div>
                                <div style="font-size: 13px; color: #374151; margin-bottom: 4px;">
                                    <strong>Year:</strong> ${year}
                                </div>
                                <div style="font-size: 13px; color: #374151; margin-bottom: 4px;">
                                    <strong>Commits in ${year}:</strong> ${yearCommits.toLocaleString()}
                                </div>
                                <div style="font-size: 13px; color: #374151; margin-bottom: 4px;">
                                    <strong>Cumulative Commits:</strong> ${commits.toLocaleString()}
                                </div>
                                <div style="font-size: 13px; color: #374151; margin-bottom: 4px;">
                                    <strong>Total Commits:</strong> ${totalCommits.toLocaleString ? totalCommits.toLocaleString() : totalCommits}
                                </div>
                                <div style="font-size: 13px; color: #374151; margin-bottom: 4px;">
                                    <strong>Top Contributor:</strong> ${topContributor}
                                </div>
                                <div style="font-size: 13px; color: #374151; margin-bottom: 4px;">
                                    <strong>Most Modified File:</strong> ${mostModifiedFile}
                                </div>
                                <div style="font-size: 13px; color: #374151;">
                                    <strong>First Commit:</strong> ${firstCommitDate}
                                </div>
                            </div>
                        `;
                    }
                }
            };

            const chart = new ApexCharts(container, options);
            await chart.render();
            this.charts.set(containerId, chart);

        } catch (error) {
            console.error('Error creating repository timeline chart:', error);
            container.innerHTML = '<div class="flex items-center justify-center h-full text-gray-500">Error loading chart data</div>';
        }
    }

    /**
     * Load Repository Timeline Data - Creates series data for each repository
     */
    async loadRepositoryTimelineData() {
        // Use AnalysisData adapter to discover repositories dynamically
        if (!window.analysisDataAdapter) {
            console.error('AnalysisData adapter not available');
            return [];
        }

        const repositories = await window.analysisDataAdapter.discoverRepositories();
        if (repositories.length === 0) {
            console.warn('No repositories found in AnalysisData');
            return [];
        }

        // Extract years from commit data - NO HARDCODED YEARS
        const repositorySeries = [];

        for (const repo of repositories) {
            try {
                // Load repository data using AnalysisData adapter
                const repoData = await window.analysisDataAdapter.loadRepositoryData(repo);
                if (!repoData || !repoData.commits) {
                    console.warn(`No commit data available for ${repo}`);
                    continue;
                }

                // Extract years from actual commit data - REAL DATA ONLY
                const commitData = repoData.commits;
                const commits = commitData.commits_by_month || {};
                const allYears = Object.keys(commits).map(monthKey => monthKey.split('-')[0]);
                const uniqueYears = [...new Set(allYears)].sort();
                
                if (uniqueYears.length === 0) {
                    console.warn(`No year data found for ${repo}`);
                    continue;
                }

                // Calculate yearly commit counts from REAL commit data
                const yearlyCommits = {};
                uniqueYears.forEach(year => {
                    yearlyCommits[year] = 0;
                });

                // Count commits per year from commits_by_month data
                Object.keys(commits).forEach(monthKey => {
                    const year = monthKey.split('-')[0];
                    if (yearlyCommits.hasOwnProperty(year)) {
                        yearlyCommits[year] += commits[monthKey];
                    }
                });

                const totalCommits = commitData.total_commits || 0;
                
                // Find top contributor from developer data - REAL DATA
                let topContributor = 'N/A';
                if (repoData.developers && repoData.developers.developers) {
                    const devs = Object.values(repoData.developers.developers);
                    if (devs.length > 0) {
                        const sortedDevs = devs.sort((a, b) => (b.total_commits || 0) - (a.total_commits || 0));
                        topContributor = sortedDevs[0].name || 'N/A';
                    }
                }

                // Convert to cumulative data for timeline effect
                const yearlyData = [];
                let cumulativeCommits = 0;
                
                uniqueYears.forEach(year => {
                    cumulativeCommits += yearlyCommits[year] || 0;
                    yearlyData.push(cumulativeCommits);
                });

                // Get first commit date from actual data - REAL DATA ONLY
                const firstCommitDate = uniqueYears[0] || 'Unknown';

                // Create series entry for this repository with year categories
                repositorySeries.push({
                    name: repo,
                    data: yearlyData,
                    yearCategories: uniqueYears, // Store for chart configuration
                    metadata: {
                        totalCommits: totalCommits,
                        topContributor: topContributor,
                        mostModifiedFile: 'N/A', // Not available in current AnalysisData format
                        firstCommitDate: firstCommitDate
                    }
                });

                console.log(`📊 Loaded timeline data for ${repo}: ${totalCommits} total commits across ${uniqueYears.length} years`);

            } catch (error) {
                console.warn(`⚠️ Could not load data for repository ${repo}:`, error);
                // Don't create empty series - just skip repositories with errors
            }
        }

        console.log(`📈 Repository timeline data prepared for ${repositorySeries.length} repositories`);
        return repositorySeries;
    }

    /**
     * Developer Distribution Pie Chart
     */
    async createDeveloperDistributionChart(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        try {
            const regionalData = await window.analyticsUtils.loadRegionalAnalysis();
            if (!regionalData) return;

            const distributionData = this.processDeveloperDistributionData(regionalData);

            const options = {
                series: distributionData.values,
                chart: {
                    type: 'pie',
                    height: '100%'
                },
                labels: distributionData.labels,
                colors: ['#DC2626', '#2563EB', '#EA580C', '#7C3AED', '#059669', '#6B7280'],
                legend: {
                    position: window.innerWidth < 768 ? 'bottom' : 'right',
                    fontSize: window.innerWidth < 640 ? '12px' : '14px'
                },
                dataLabels: {
                    enabled: true,
                    formatter: function (val) {
                        return Math.round(val) + '%';
                    }
                },
                tooltip: {
                    y: {
                        formatter: function(val, opts) {
                            const total = distributionData.values.reduce((a, b) => a + b, 0);
                            const percentage = ((val / total) * 100).toFixed(1);
                            return val + ' developers (' + percentage + '%)';
                        }
                    }
                }
            };

            const chart = new ApexCharts(container, options);
            await chart.render();
            this.charts.set(containerId, chart);

        } catch (error) {
            console.error('Error creating developer distribution chart:', error);
            container.innerHTML = '<div class="flex items-center justify-center h-full text-gray-500">Error loading chart data</div>';
        }
    }

    /**
     * Global Activity Map using Leaflet
     */
    async createGlobalActivityMap(containerId) {
        let container = document.getElementById(containerId);
        if (!container) {
            console.error('🗺️ Map container not found:', containerId);
            return;
        }

        try {
            console.log('🗺️ Creating global activity map...');
            
            // Clear any existing map more thoroughly
            if (this.mapInstance) {
                console.log('🗺️ Removing existing map instance');
                try {
                    this.mapInstance.remove();
                } catch (e) {
                    console.warn('🗺️ Error removing existing map:', e);
                }
                this.mapInstance = null;
            }
            
            // Clean up any existing map in this container
            this.cleanupMapContainer(container);
            
            // Track this container
            this.mapContainers.add(containerId);
            
            // More thorough container cleanup
            container.innerHTML = '';
            container.className = 'responsive-chart'; // Reset classes
            container.style.height = '400px';
            container.style.width = '100%';
            container.style.position = 'relative';
            
            // Remove any remaining Leaflet-specific attributes
            Array.from(container.attributes).forEach(attr => {
                if (attr.name.startsWith('data-leaflet') || attr.name.startsWith('_leaflet')) {
                    container.removeAttribute(attr.name);
                }
            });
            
            // Wait longer for DOM to be ready and cleanup to complete
            await new Promise(resolve => setTimeout(resolve, 200));

            const regionalData = await window.analyticsUtils.loadRegionalAnalysis();
            if (!regionalData || !regionalData.regional_breakdown) {
                console.warn('🗺️ No regional data available for map');
                container.innerHTML = '<div class="flex items-center justify-center h-full text-gray-500">No regional data available</div>';
                return;
            }

            console.log('🗺️ Regional data loaded:', regionalData);

            // Check if Leaflet is available
            if (typeof L === 'undefined') {
                console.error('🗺️ Leaflet.js is not loaded');
                container.innerHTML = '<div class="flex items-center justify-center h-full text-gray-500">Map library not loaded</div>';
                return;
            }

            // Final check - if container still has Leaflet data, recreate the container
            if (container._leaflet_id || container.querySelector('.leaflet-container')) {
                console.log('🗺️ Forcing container recreation due to persistent Leaflet state');
                const parent = container.parentNode;
                const newContainer = document.createElement('div');
                newContainer.id = containerId;
                newContainer.className = 'responsive-chart';
                newContainer.style.height = '400px';
                newContainer.style.width = '100%';
                newContainer.style.position = 'relative';
                parent.replaceChild(newContainer, container);
                container = newContainer; // Update reference
                
                // Wait for DOM update
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // Initialize map with error handling
            let map;
            try {
                map = L.map(container, {
                    center: [20, 0],
                    zoom: 2,
                    scrollWheelZoom: false,
                    doubleClickZoom: false,
                    boxZoom: false,
                    keyboard: false,
                    dragging: true,
                    touchZoom: false
                });
            } catch (leafletError) {
                console.error('🗺️ Error creating Leaflet map:', leafletError);
                
                // If it's a container already initialized error, try one more time with a fresh container
                if (leafletError.message.includes('already initialized')) {
                    console.log('🗺️ Attempting container recreation for reinitialization error');
                    try {
                        const parent = container.parentNode;
                        const freshContainer = document.createElement('div');
                        freshContainer.id = containerId + '_fresh';
                        freshContainer.className = 'responsive-chart';
                        freshContainer.style.height = '400px';
                        freshContainer.style.width = '100%';
                        freshContainer.style.position = 'relative';
                        parent.replaceChild(freshContainer, container);
                        
                        // Try map creation with fresh container
                        map = L.map(freshContainer, {
                            center: [20, 0],
                            zoom: 2,
                            scrollWheelZoom: false,
                            doubleClickZoom: false,
                            boxZoom: false,
                            keyboard: false,
                            dragging: true,
                            touchZoom: false
                        });
                        container = freshContainer; // Update reference
                    } catch (retryError) {
                        console.error('🗺️ Retry also failed:', retryError);
                        container.innerHTML = '<div class="flex items-center justify-center h-full text-gray-500">Map initialization failed</div>';
                        return;
                    }
                } else {
                    container.innerHTML = '<div class="flex items-center justify-center h-full text-gray-500">Error initializing map</div>';
                    return;
                }
            }

            // Store map instance for cleanup
            this.mapInstance = map;

            // Add tile layer with error handling
            try {
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap contributors',
                    maxZoom: 18,
                    errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
                }).addTo(map);
            } catch (tileError) {
                console.error('🗺️ Error adding tile layer:', tileError);
            }

            // Add markers for development centers
            const locations = this.getGlobalDevelopmentLocations(regionalData);
            console.log('🗺️ Development locations:', locations);
            
            if (locations.length === 0) {
                console.warn('🗺️ No development locations found, showing placeholder');
                // Show a simple placeholder instead of an empty map
                const swedenMarker = L.circleMarker([59.3293, 18.0686], {
                    radius: 15,
                    fillColor: '#3B82F6',
                    color: '#000',
                    weight: 2,
                    opacity: 0.8,
                    fillOpacity: 0.6
                }).addTo(map);
                
                swedenMarker.bindPopup('<b>Development Center</b><br>Primary Development Location');
            }

            // Add markers with error handling
            locations.forEach(location => {
                try {
                    if (location.developers > 0 || location.commits > 0) {
                        const markerSize = Math.max(8, Math.min(40, Math.sqrt(location.commits) / 10));
                        
                        const marker = L.circleMarker([location.lat, location.lng], {
                            radius: markerSize,
                            fillColor: location.color,
                            color: '#000',
                            weight: 2,
                            opacity: 0.8,
                            fillOpacity: 0.6
                        }).addTo(map);
                        
                        marker.bindPopup(`
                            <div class="p-2">
                                <strong class="text-lg">${location.name}</strong><br/>
                                <div class="mt-1">
                                    <span class="text-sm">👥 Developers: <strong>${location.developers.toLocaleString()}</strong></span><br/>
                                    <span class="text-sm">💻 Commits: <strong>${location.commits.toLocaleString()}</strong></span>
                                </div>
                            </div>
                        `, {
                            maxWidth: 250,
                            className: 'custom-popup'
                        });
                    }
                } catch (markerError) {
                    console.warn('🗺️ Error creating marker for location:', location.name, markerError);
                }
            });

            // Force map to render properly
            setTimeout(() => {
                if (map && map.invalidateSize) {
                    map.invalidateSize();
                }
            }, 200);

            console.log('🗺️ Global activity map created successfully');

        } catch (error) {
            console.error('🗺️ Error creating global activity map:', error);
            container.innerHTML = `
                <div class="flex items-center justify-center h-full text-gray-500">
                    <div class="text-center">
                        <i class="fas fa-exclamation-triangle text-4xl mb-4 text-red-500"></i>
                        <p>Error loading map data</p>
                        <p class="text-xs mt-2">Check console for details</p>
                    </div>
                </div>
            `;
        }
    }

    /**
     * Technology Stack Chart
     */
    async createTechnologyStackChart(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        try {
            const techData = await window.analyticsUtils.loadTechnologyStack();
            if (!techData) return;

            const stackData = this.processTechnologyStackData(techData);

            const options = {
                series: [{
                    data: stackData.data
                }],
                chart: {
                    type: 'bar',
                    height: '100%',
                    horizontal: true
                },
                plotOptions: {
                    bar: {
                        borderRadius: 4,
                        dataLabels: {
                            position: 'top'
                        }
                    }
                },
                dataLabels: {
                    enabled: true,
                    offsetX: -6,
                    style: {
                        fontSize: '12px',
                        colors: ['#fff']
                    }
                },
                xaxis: {
                    categories: stackData.categories,
                    title: {
                        text: 'Usage Count'
                    }
                },
                yaxis: {
                    title: {
                        text: 'Technologies'
                    }
                },
                colors: ['#1E40AF']
            };

            const chart = new ApexCharts(container, options);
            await chart.render();
            this.charts.set(containerId, chart);

        } catch (error) {
            console.error('Error creating technology stack chart:', error);
            container.innerHTML = '<div class="flex items-center justify-center h-full text-gray-500">Error loading chart data</div>';
        }
    }

    /**
     * Module Ownership Chart
     */
    async createModuleOwnershipChart(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        try {
            const ownershipData = await window.analyticsUtils.loadModuleOwnership();
            if (!ownershipData) return;

            const moduleData = this.processModuleOwnershipData(ownershipData);

            const options = {
                series: moduleData.series,
                chart: {
                    type: 'donut',
                    height: '100%'
                },
                labels: moduleData.labels,
                colors: ['#1E40AF', '#DC2626', '#059669', '#7C3AED', '#EA580C', '#DB2777', '#0F766E'],
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
                tooltip: {
                    y: {
                        formatter: function(val) {
                            return val + ' modules';
                        }
                    }
                }
            };

            const chart = new ApexCharts(container, options);
            await chart.render();
            this.charts.set(containerId, chart);

        } catch (error) {
            console.error('Error creating module ownership chart:', error);
            container.innerHTML = '<div class="flex items-center justify-center h-full text-gray-500">Error loading chart data</div>';
        }
    }

    /**
     * Data Processing Methods
     */


    processDeveloperDistributionData(regionalData) {
        const labels = [];
        const values = [];
        
        if (regionalData.regional_summary || regionalData.regional_breakdown) {
            const regions = regionalData.regional_summary || regionalData.regional_breakdown;
            Object.entries(regions).forEach(([region, data]) => {
                const developerCount = data.developers_count || data.unique_developers || 0;
                if (developerCount > 0) {
                    labels.push(`${this.getRegionFlag(region)} ${region}`);
                    values.push(developerCount);
                }
            });
        }
        
        return { labels, values };
    }

    processTechnologyStackData(techData) {
        const categories = [];
        const data = [];
        
        let techUsage = {};
        
        // Process technology usage from overall data
        if (techData.overall_technology_usage) {
            techUsage = { ...techData.overall_technology_usage };
        }
        
        // Sort by usage and take top 10
        const sortedTech = Object.entries(techUsage)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10);
        
        sortedTech.forEach(([tech, count]) => {
            categories.push(tech.toUpperCase());
            data.push(count);
        });
        
        return { categories, data };
    }

    processModuleOwnershipData(ownershipData) {
        const labels = [];
        const series = [];
        
        if (ownershipData.module_summary) {
            // Take top 7 modules by file count
            const topModules = Object.entries(ownershipData.module_summary)
                .sort(([,a], [,b]) => b.total_files - a.total_files)
                .slice(0, 7);
            
            topModules.forEach(([module, data]) => {
                labels.push(module);
                series.push(data.total_files);
            });
        }
        
        return { labels, series };
    }

    getGlobalDevelopmentLocations(regionalData) {
        console.log('🗺️ Processing regional data for map:', regionalData);
        
        // Country to coordinates mapping (generic coordinates - can be enhanced with geocoding)
        const countryCoordinates = {
            'Sweden': { lat: 59.3293, lng: 18.0686, color: '#3B82F6' },
            'China': { lat: 39.9042, lng: 116.4074, color: '#DC2626' },
            'United States': { lat: 37.7749, lng: -122.4194, color: '#2563EB' },
            'India': { lat: 12.9716, lng: 77.5946, color: '#EA580C' },
            'Canada': { lat: 43.6532, lng: -79.3832, color: '#7C3AED' },
            'United Kingdom': { lat: 51.5074, lng: -0.1278, color: '#059669' },
            'Germany': { lat: 52.5200, lng: 13.4050, color: '#7C2D12' },
            'France': { lat: 48.8566, lng: 2.3522, color: '#DB2777' },
            'Japan': { lat: 35.6762, lng: 139.6503, color: '#0F766E' },
            'Australia': { lat: -33.8688, lng: 151.2093, color: '#F59E0B' },
            'Brazil': { lat: -23.5505, lng: -46.6333, color: '#10B981' },
            'Russia': { lat: 55.7558, lng: 37.6173, color: '#6366F1' }
        };
        
        // Build location map dynamically from regional data - NO HARDCODED DATA
        const locationMap = {};
        
        // Dynamically create location entries from regional breakdown data
        if (regionalData && regionalData.regional_breakdown) {
            Object.entries(regionalData.regional_breakdown).forEach(([country, data]) => {
                const coords = countryCoordinates[country] || {
                    lat: 20, // Default center if country not in map
                    lng: 0,
                    color: '#6B7280'
                };
                
                locationMap[country] = {
                    name: `${country} Development Center${(data.developers_count || 0) > 1 ? 's' : ''}`,
                    lat: coords.lat,
                    lng: coords.lng,
                    color: coords.color,
                    developers: data.developers_count || 0,
                    commits: data.commits || 0
                };
            });
        }
        
        // Fallback: if regional_breakdown is not available, try regional_summary
        if (Object.keys(locationMap).length === 0 && regionalData && regionalData.regional_summary) {
            Object.entries(regionalData.regional_summary).forEach(([region, data]) => {
                const coords = countryCoordinates[region] || {
                    lat: 20,
                    lng: 0,
                    color: '#6B7280'
                };
                
                locationMap[region] = {
                    name: `${region} Development Center${(data.developers_count || data.unique_developers || 0) > 1 ? 's' : ''}`,
                    lat: coords.lat,
                    lng: coords.lng,
                    color: coords.color,
                    developers: data.developers_count || data.unique_developers || data.total_developers || 0,
                    commits: data.commits || data.total_commits || 0
                };
            });
        }
        
        if (Object.keys(locationMap).length === 0) {
            console.warn('🗺️ No regional data found, location map will be empty');
        }
        
        // Convert to array and filter out locations with no activity
        const locations = Object.values(locationMap).filter(location => 
            location.developers > 0 || location.commits > 0
        );
        
        console.log('🗺️ Final locations for map:', locations);
        return locations;
    }

    getRegionFlag(region) {
        const flags = {
            'China': '🇨🇳',
            'United States': '🇺🇸',
            'India': '🇮🇳',
            'Canada': '🇨🇦',
            'Unknown': '🌍'
        };
        return flags[region] || '🌍';
    }

    /**
     * Chart Management
     */
    destroyChart(containerId) {
        const chart = this.charts.get(containerId);
        if (chart) {
            chart.destroy();
            this.charts.delete(containerId);
        }
    }

    cleanupMapContainer(container) {
        // Remove Leaflet-specific properties and attributes
        if (container._leaflet_id) {
            console.log('🗺️ Cleaning existing Leaflet container state');
            delete container._leaflet_id;
        }
        
        // Remove any Leaflet-specific data attributes
        Array.from(container.attributes).forEach(attr => {
            if (attr.name.startsWith('data-leaflet') || attr.name.startsWith('_leaflet')) {
                container.removeAttribute(attr.name);
            }
        });
        
        // Remove any Leaflet CSS classes
        container.className = container.className.replace(/leaflet-[^\s]*/g, '').trim();
    }

    destroyAllCharts() {
        // Destroy regular charts
        this.charts.forEach((chart, id) => {
            chart.destroy();
        });
        this.charts.clear();
        
        // Clean up map instance
        if (this.mapInstance) {
            try {
                this.mapInstance.remove();
            } catch (e) {
                console.warn('🗺️ Error removing map instance:', e);
            }
            this.mapInstance = null;
        }
        
        // Clean up all tracked map containers
        this.mapContainers.forEach(containerId => {
            const container = document.getElementById(containerId);
            if (container) {
                this.cleanupMapContainer(container);
            }
        });
        this.mapContainers.clear();
    }

    async refreshAllCharts() {
        console.log('Refreshing all charts...');
        
        // Destroy existing charts
        this.destroyAllCharts();
        
        // Recreate charts
        await this.createCommitTimelineChart('commitTimelineChart');
        await this.createDeveloperDistributionChart('developerDistributionChart');
        await this.createGlobalActivityMap('globalActivityMap');
        await this.createTechnologyStackChart('technologyStackChart');
    }

    /**
     * Responsive handling
     */
    handleResize() {
        this.charts.forEach((chart) => {
            if (chart.windowResizeHandler) {
                chart.windowResizeHandler();
            }
        });
        
        if (this.mapInstance) {
            this.mapInstance.invalidateSize();
        }
    }
}

// Initialize global charts instance
window.analyticsCharts = new AnalyticsCharts();

// Backward compatibility alias
window.formPipeCharts = window.analyticsCharts;

// Handle window resize
window.addEventListener('resize', () => {
    window.analyticsCharts.handleResize();
});

// Analytics charts are the primary implementation