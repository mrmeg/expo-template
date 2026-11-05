use http_body_util::Full;
use hyper::{Method, Request, Response, body::Bytes, server::conn::http1, service::service_fn};
use hyper_util::rt::TokioIo;
use std::convert::Infallible;
use tokio::net::TcpListener;

#[tokio::main(flavor = "current_thread")]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let port: u16 = std::env::var("PORT")?.parse()?;
    let listener = TcpListener::bind(("127.0.0.1", port)).await?;
    loop {
        let (stream, _) = listener.accept().await?;
        tokio::spawn(async move {
            let service = service_fn(|req: Request<hyper::body::Incoming>| async move {
                let response = if req.method() == Method::GET && req.uri().path() == "/" {
                    Response::builder()
                        .header("content-type", "application/json")
                        .body(Full::new(Bytes::from_static(
                            b"{\"ok\":true,\"service\":\"server-bench\"}",
                        )))
                        .unwrap()
                } else {
                    Response::builder()
                        .status(404)
                        .body(Full::new(Bytes::new()))
                        .unwrap()
                };
                Ok::<_, Infallible>(response)
            });
            if let Err(error) = http1::Builder::new()
                .serve_connection(TokioIo::new(stream), service)
                .await
            {
                eprintln!("connection: {error}");
            }
        });
    }
}
