const http = require('http');
const Koa = require('koa');
const { koaBody } = require('koa-body');
const app = new Koa();
const fs = require('fs');

let messages = [];

app.use(
  koaBody({
    jsonLimit: '200mb',
    formLimit: '200mb',
    textLimit: '200mb',
    multipart: true,
    formidable: { maxFileSize: 200 * 1024 * 1024 },
  })
);

// CORS middleware
app.use(async (ctx, next) => {
  ctx.response.set('Access-Control-Allow-Origin', '*');
  ctx.response.set('Access-Control-Allow-Methods', 'DELETE, PUT, PATCH, GET, POST');
  ctx.response.set('Access-Control-Allow-Headers', 'Content-Type, Accept, Origin, X-Requested-With');
  await next();
});

// OPTIONS preflight request handling
app.use(async (ctx, next) => {
  if (ctx.request.method === 'OPTIONS') {
    ctx.response.status = 204;
    return;
  }
  await next();
});

// Main request handling
app.use(async (ctx, next) => {
  if (ctx.request.method === 'POST') {
    const url = ctx.request.url;
    const method = ctx.request.body.method; // Используем метод из тела запроса
    console.log(`Received ${ctx.request.method} request on ${url} with method: ${method}`);

    try {
      if (method === 'createTextMessage') {
        const responseObject = {
          value: ctx.request.body.value,
          type: ctx.request.body.type,
        };
        messages.push(responseObject);
        ctx.response.body = { responseMessage: responseObject.value };
        ctx.response.status = 201;
      } else if (method === 'createFileMessage') {
        const file = ctx.request.files.file;
        const fileType = ctx.request.body.fileType;

        if (!file) {
          ctx.response.status = 400; // Bad request
          ctx.response.body = { error: 'File not provided' };
          return;
        }

        try {
          const fileBuffer = fs.readFileSync(file.filepath);
          const responseObject = {
            value: Array.from(new Uint8Array(fileBuffer)),
            filename: file.originalFilename,
            fileType: fileType,
            size: file.size,
            lastModified: file.lastModifiedDate ? file.lastModifiedDate.getTime() : Date.now()
          };

          messages.push(responseObject);
          ctx.response.body = { responseMessage: 'File uploaded successfully', fileData: responseObject };
          ctx.response.status = 201;
        } catch (error) {
          console.error('Error reading file:', error);
          ctx.response.status = 500; // Internal server error
          ctx.response.body = { error: 'Error processing the file' };
        }
      } else if (method === 'createGeoMessage') {
        const responseObject = {
          latitude: ctx.request.body.latitude,
          longitude: ctx.request.body.longitude,
          type: ctx.request.body.type,
        };
        messages.push(responseObject);
        ctx.response.body = { responseLatitude: responseObject.latitude, responseLongitude: responseObject.longitude };
        ctx.response.status = 201;
      } else if (method === 'deleteMessages') {
        messages = [];
        ctx.response.body = { responseMessage: 'success' };
        ctx.response.status = 201;
      } else {
        ctx.response.status = 404; // Not found
        ctx.response.body = { error: 'Method not supported' };
      }
    } catch (error) {
      console.error('Error processing request:', error);
      ctx.response.status = 500; // Internal server error
      ctx.response.body = { error: 'Internal Server Error' };
    }

    return;
  }
  await next();
});

// GET request handling
app.use(async (ctx, next) => {
  if (ctx.request.method === 'GET') {
    const url = new URL(ctx.request.url, `http://${ctx.request.headers.host}`);
    const offset = parseInt(url.searchParams.get('offset'), 10) || 0;
    const limit = parseInt(url.searchParams.get('limit'), 10) || 10;

    const start = Math.max(messages.length - offset - limit, 0);
    const end = messages.length - offset;
    const paginatedMessages = messages.slice(start, end).reverse();
    ctx.response.body = paginatedMessages;
    console.log(paginatedMessages);
  }
  await next();
});

const server = http.createServer(app.callback());
const port = 7070;

server.listen(port, (err) => {
  if (err) {
    console.error('Server startup error:', err);
    return;
  }
  console.log('Server is listening on port ' + port);
});
