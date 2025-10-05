// Quick script to check GridFS files and report connections
const { MongoClient, GridFSBucket } = require('mongodb');

async function checkGridFSFiles() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb+srv://esdeath4l:PgHD54dXgM58cG2l@atlascluster.bzvnydu.mongodb.net/whistle?retryWrites=true&w=majority');
  
  try {
    await client.connect();
    const db = client.db('whistle');
    
    // Check GridFS files
    const imagesBucket = new GridFSBucket(db, { bucketName: 'images' });
    const videosBucket = new GridFSBucket(db, { bucketName: 'videos' });
    
    console.log('🔍 Checking GridFS files...');
    
    // Get all image files
    const imageFiles = await imagesBucket.find({}).toArray();
    console.log(`📸 Found ${imageFiles.length} image files in GridFS`);
    
    imageFiles.forEach((file, index) => {
      console.log(`  Image ${index + 1}: ${file._id} - ${file.filename} (${file.length} bytes)`);
    });
    
    // Get all video files
    const videoFiles = await videosBucket.find({}).toArray();
    console.log(`🎥 Found ${videoFiles.length} video files in GridFS`);
    
    videoFiles.forEach((file, index) => {
      console.log(`  Video ${index + 1}: ${file._id} - ${file.filename} (${file.length} bytes)`);
    });
    
    // Check reports collection
    const reports = await db.collection('reports').find({}).toArray();
    console.log(`📋 Found ${reports.length} reports in database`);
    
    let reportsWithFiles = 0;
    reports.forEach((report, index) => {
      const hasFiles = !!(report.photo_file_id || report.video_file_id || (report.additional_media && report.additional_media.length > 0));
      if (hasFiles) {
        reportsWithFiles++;
        console.log(`  Report ${report.shortId}: photo=${!!report.photo_file_id}, video=${!!report.video_file_id}, additional=${report.additional_media?.length || 0}`);
      }
    });
    
    console.log(`📊 Summary: ${reportsWithFiles}/${reports.length} reports have GridFS file references`);
    
    // Check for orphaned files
    const allFileIds = new Set([
      ...imageFiles.map(f => f._id.toString()),
      ...videoFiles.map(f => f._id.toString())
    ]);
    
    const linkedFileIds = new Set();
    reports.forEach(report => {
      if (report.photo_file_id) linkedFileIds.add(report.photo_file_id.toString());
      if (report.video_file_id) linkedFileIds.add(report.video_file_id.toString());
      if (report.additional_media) {
        report.additional_media.forEach(id => linkedFileIds.add(id.toString()));
      }
    });
    
    const orphanedFiles = [...allFileIds].filter(id => !linkedFileIds.has(id));
    console.log(`🔓 Found ${orphanedFiles.length} orphaned GridFS files not linked to any report`);
    
    if (orphanedFiles.length > 0) {
      console.log('Orphaned file IDs:');
      orphanedFiles.forEach(id => console.log(`  - ${id}`));
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  checkGridFSFiles();
}

module.exports = { checkGridFSFiles };