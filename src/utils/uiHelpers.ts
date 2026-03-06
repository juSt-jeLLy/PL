export const getSeverityIcon = (severity: string) => {
  switch (severity) {
    case "CRITICAL": return "🐛";
    case "HIGH": return "🔒";
    case "MEDIUM": return "⚡";
    case "LOW": return "👁️";
    default: return "💻";
  }
};

export const getCategoryIcon = (category: string) => {
  switch (category) {
    case "Architecture": return "🏗️";
    case "Readability": return "📖";
    case "Testing": return "🧪";
    case "Edge Case": return "👁️";
    case "Better Approach": return "⚡";
    default: return "💻";
  }
};

export const getSeverityColor = (severity: string) => {
  switch (severity) {
    case "CRITICAL": return "border-red-500 bg-red-500/10 text-red-400";
    case "HIGH": return "border-orange-500 bg-orange-500/10 text-orange-400";
    case "MEDIUM": return "border-yellow-500 bg-yellow-500/10 text-yellow-400";
    case "LOW": return "border-green-500 bg-green-500/10 text-green-400";
    case "INFO": return "border-blue-500 bg-blue-500/10 text-blue-400";
    default: return "border-gray-500 bg-gray-500/10 text-gray-400";
  }
};

export const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "HIGH": return "border-orange-500 bg-orange-500/10 text-orange-400";
    case "MEDIUM": return "border-yellow-500 bg-yellow-500/10 text-yellow-400";
    case "LOW": return "border-green-500 bg-green-500/10 text-green-400";
    default: return "border-gray-500 bg-gray-500/10 text-gray-400";
  }
};
