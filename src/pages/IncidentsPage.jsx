// ... imports ...
import { Search, Filter, ChevronDown, Upload, PlayCircle } from 'lucide-react'; // Added Upload, PlayCircle
import Header from '../components/Header';
import Footer from '../components/Footer';

const IncidentsPage = () => {
    const [incidents, setIncidents] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [severityFilter, setSeverityFilter] = useState('All');
    const [statusFilter, setStatusFilter] = useState('All');
    const [uploading, setUploading] = useState(false);

    // Fetch Incidents
    const fetchIncidents = async () => {
        try {
            const res = await fetch('http://localhost:3000/api/history');
            const data = await res.json();
            if (data.success) {
                setIncidents(data.data);
            }
        } catch (err) {
            console.error("Failed to fetch incidents:", err);
        }
    };

    React.useEffect(() => {
        fetchIncidents();
    }, []);

    // Upload Video
    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('video', file);

        setUploading(true);
        try {
            const res = await fetch('http://localhost:3000/api/upload', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                // Determine incident type based on random logic or assume pending analysis
                // For now, just refresh the list. The list shows uploads.
                // We could trigger analysis mock here if we wanted.
                // Simulate analysis:
                await fetch('http://localhost:3000/api/analysis', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        videoId: data.videoId,
                        incidentType: Math.random() > 0.5 ? 'Accident' : 'Traffic Violation',
                        confidence: (Math.random() * 0.5 + 0.5).toFixed(2),
                        details: { notes: "Detected automatically" }
                    })
                });

                fetchIncidents();
            } else {
                alert('Upload failed: ' + data.message);
            }
        } catch (err) {
            console.error("Upload error:", err);
            alert('Upload error');
        } finally {
            setUploading(false);
        }
    };

    const filteredIncidents = incidents.filter(incident => {
        // Map DB fields to UI
        const location = "Recorded Video"; // DB doesn't have location yet
        const severity = incident.incident_type || "Unknown";
        const status = incident.incident_type ? "Analyzed" : "Pending";

        const matchesSearch = (incident.original_name && incident.original_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (severity && severity.toLowerCase().includes(searchTerm.toLowerCase()));

        // Simple filter mapping
        const matchesSeverity = severityFilter === 'All' || severity === severityFilter;
        // const matchesStatus = statusFilter === 'All' || status === statusFilter; // Status filter disabled for now or map it

        return matchesSearch && matchesSeverity;
    });

    const getSeverityColor = (severity) => {
        if (!severity) return 'text-slate-400';
        const s = severity.toLowerCase();
        if (s.includes('accident') || s.includes('crash') || s.includes('critical')) return 'text-critical';
        return 'text-warning';
    };

    return (
        <div className="min-h-screen w-full bg-darker flex flex-col font-sans text-white">
            <Header />

            <main className="flex-1 p-6 overflow-auto">
                <div className="max-w-7xl mx-auto">
                    {/* Page Header & Controls */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <h1 className="text-2xl font-bold text-white">Video Incidents Management</h1>

                        <div className="flex flex-wrap items-center gap-3">
                            {/* Upload Button */}
                            <label className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg cursor-pointer flex items-center gap-2 transition-colors">
                                <Upload className="w-4 h-4" />
                                {uploading ? 'Uploading...' : 'Upload Video'}
                                <input type="file" accept="video/*" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                            </label>

                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search videos..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="bg-panel border border-panel-border rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary w-64"
                                />
                            </div>

                            {/* Filters (Simplified) */}
                            {/* ... kept existing filters structure if needed, or remove ... */}
                        </div>
                    </div>

                    {/* Data Table */}
                    <div className="bg-panel/50 backdrop-blur-sm border border-panel-border rounded-xl overflow-hidden shadow-xl">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="bg-slate-800/50 border-b border-panel-border text-slate-400">
                                        <th className="px-6 py-4 font-semibold">ID</th>
                                        <th className="px-6 py-4 font-semibold">File Name</th>
                                        <th className="px-6 py-4 font-semibold">Incident Type</th>
                                        <th className="px-6 py-4 font-semibold">Confidence</th>
                                        <th className="px-6 py-4 font-semibold">Date</th>
                                        <th className="px-6 py-4 font-semibold text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-panel-border">
                                    {filteredIncidents.map((incident) => (
                                        <tr key={incident.id} className="hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4 font-mono text-slate-300">#{incident.id}</td>
                                            <td className="px-6 py-4 text-white" title={incident.filename}>{incident.original_name}</td>
                                            <td className={`px-6 py-4 font-medium ${getSeverityColor(incident.incident_type)}`}>
                                                {incident.incident_type || "Pending Analysis"}
                                            </td>
                                            <td className="px-6 py-4 text-slate-300">
                                                {incident.confidence ? (incident.confidence * 100).toFixed(0) + '%' : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-slate-300">
                                                {new Date(incident.video_date).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <a
                                                    href={`http://localhost:3000/storage/${incident.filename}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-info hover:text-blue-400 border border-info/30 hover:border-info px-3 py-1 rounded text-xs transition-all inline-flex items-center gap-1"
                                                >
                                                    <PlayCircle className="w-3 h-3" /> View Video
                                                </a>
                                            </td>
                                        </tr>
                                    ))}

                                    {filteredIncidents.length === 0 && (
                                        <tr>
                                            <td colSpan="6" className="px-6 py-8 text-center text-slate-500">
                                                No videos found. Upload one to get started.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
};

export default IncidentsPage;
