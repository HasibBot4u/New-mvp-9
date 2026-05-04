interface CourseSchemaProps {
  name: string;
  description: string;
  providerName?: string;
  providerUrl?: string;
  instructorName?: string;
}

export function CourseStructuredData({
  name,
  description,
  providerName = "NexusEdu",
  providerUrl = "https://nexusedu.netlify.app",
  instructorName = "Instructor"
}: CourseSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Course",
    "name": name,
    "description": description,
    "provider": {
      "@type": "Organization",
      "name": providerName,
      "sameAs": providerUrl
    },
    "hasCourseInstance": {
      "@type": "CourseInstance",
      "courseMode": "online",
      "instructor": {
        "@type": "Person",
        "name": instructorName
      }
    }
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

interface VideoSchemaProps {
  name: string;
  description: string;
  thumbnailUrl: string;
  uploadDate: string;
  duration?: string; // ISO 8601 format like PT1H30M
}

export function VideoStructuredData({
  name,
  description,
  thumbnailUrl,
  uploadDate,
  duration
}: VideoSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "name": name,
    "description": description,
    "thumbnailUrl": [thumbnailUrl],
    "uploadDate": uploadDate,
    ...(duration && { "duration": duration })
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
