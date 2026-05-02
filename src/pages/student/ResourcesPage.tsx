import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileText, Download, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";

interface ResourceRow {
  id: string;
  chapter_id: string;
  title: string;
  title_bn: string | null;
  drive_file_id: string | null;
  pdf_url: string | null;
  display_order: number;
}

export default function ResourcesPage() {
  const [resources, setResources] = useState<ResourceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResources = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('resources' as any)
        .select('*')
        .eq('is_active', true)
        .order('display_order');
        
      setResources((data || []) as any as ResourceRow[]);
      setLoading(false);
    };

    fetchResources();
  }, []);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-24 md:pb-8">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-bold tracking-tight bangla">
          প্র্যাকটিস শীট
        </h1>
        <p className="text-foreground-muted bangla">গুরুত্বপূর্ণ স্টাডি ম্যাটেরিয়াল এবং প্র্যাকটিস শীট ডাউনলোড করুন</p>
      </header>

      {resources.length === 0 ? (
        <div className="text-center py-20 bg-surface rounded-2xl border border-white/5">
          <FileText className="w-12 h-12 text-foreground-dim mx-auto mb-3" />
          <p className="text-foreground-muted bangla">কোনো শীট পাওয়া যায়নি</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {resources.map((resource, i) => {
            const previewUrl = resource.drive_file_id 
              ? `https://drive.google.com/file/d/${resource.drive_file_id}/preview`
              : resource.pdf_url;
              
            const downloadUrl = resource.drive_file_id
              ? `https://drive.google.com/uc?export=download&id=${resource.drive_file_id}`
              : resource.pdf_url;

            return (
              <motion.div
                key={resource.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="group relative p-5 bg-surface rounded-2xl border border-white/5 hover:border-primary/30 transition-colors flex flex-col gap-4"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0 pt-1">
                    <h3 className="font-bold text-foreground truncate bangla">
                      {resource.title_bn || resource.title}
                    </h3>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 mt-auto pt-2 grid grid-cols-2">
                  {previewUrl && (
                    <a
                      href={previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 py-2 px-3 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-foreground-muted hover:text-white transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span className="bangla tracking-wide">দেখুন</span>
                    </a>
                  )}
                  {downloadUrl && (
                    <a
                      href={downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 py-2 px-3 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-sm transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      <span className="bangla tracking-wide">ডাউনলোড</span>
                    </a>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
