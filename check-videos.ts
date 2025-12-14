import prisma from './src/database/prisma';

async function checkVideos() {
  const videos = await prisma.lessonVideo.findMany({
    include: {
      lesson: true
    }
  });

  console.log('Videos in database:');
  videos.forEach(v => {
    console.log(`- Lesson ${v.lesson.lessonNumber}: ${v.title}`);
    console.log(`  URL: ${v.videoUrl}`);
  });

  await prisma.$disconnect();
}

checkVideos();
