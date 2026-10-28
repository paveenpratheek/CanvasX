const ytRegex = /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:\S+)?$/i;
console.log('Test 1:', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'.match(ytRegex) !== null);
console.log('Test 2:', 'https://youtu.be/dQw4w9WgXcQ'.match(ytRegex) !== null);
console.log('Test 3:', 'https://youtube.com/watch?v=dQw4w9WgXcQ&t=5s'.match(ytRegex) !== null);
console.log('Test 4:', 'www.youtube.com/watch?v=dQw4w9WgXcQ'.match(ytRegex) !== null);
