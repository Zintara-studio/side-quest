package com.sidequest.arena.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Caps the raw request-body size for the image-upload endpoint ({@code POST /media}) so a caller cannot
 * force the framework to buffer a huge base64 JSON body into memory (heap exhaustion / DoS) before any
 * validation runs. The size checks inside {@code MediaService} only bound the DECODED image; this bounds
 * the raw request body first — both via the declared {@code Content-Length} and by counting bytes as the
 * body is read (so a chunked or mis-declared length can't slip past).
 */
public class RequestSizeLimitFilter extends OncePerRequestFilter {

    /** ~1 MB — comfortably above a 256KB banner's base64 (~350KB) plus the JSON envelope. */
    private static final long MAX_UPLOAD_BYTES = 1_048_576L;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (isMediaUpload(request)) {
            long declared = request.getContentLengthLong();
            if (declared > MAX_UPLOAD_BYTES) {
                reject(response);
                return;
            }
            chain.doFilter(new LimitedBodyRequest(request, MAX_UPLOAD_BYTES), response);
            return;
        }
        chain.doFilter(request, response);
    }

    private static boolean isMediaUpload(HttpServletRequest request) {
        String uri = request.getRequestURI();
        return "POST".equalsIgnoreCase(request.getMethod()) && uri != null && uri.endsWith("/media");
    }

    private static void reject(HttpServletResponse response) throws IOException {
        response.setStatus(HttpServletResponse.SC_REQUEST_ENTITY_TOO_LARGE); // 413
        response.setContentType("application/json");
        response.getWriter().write(
                "{\"code\":\"PAYLOAD_TOO_LARGE\",\"message\":\"Image upload is too large.\"}");
    }

    /** Wraps the request so reading more than {@code limit} bytes from the body fails fast. */
    private static final class LimitedBodyRequest extends HttpServletRequestWrapper {
        private final long limit;

        LimitedBodyRequest(HttpServletRequest request, long limit) {
            super(request);
            this.limit = limit;
        }

        @Override
        public ServletInputStream getInputStream() throws IOException {
            ServletInputStream delegate = super.getInputStream();
            return new ServletInputStream() {
                private long count;

                private void tally(int n) throws IOException {
                    if (n > 0) {
                        count += n;
                        if (count > limit) {
                            throw new IOException("Request body exceeds the maximum allowed size");
                        }
                    }
                }

                @Override
                public int read() throws IOException {
                    int b = delegate.read();
                    if (b != -1) {
                        tally(1);
                    }
                    return b;
                }

                @Override
                public int read(byte[] buf, int off, int len) throws IOException {
                    int n = delegate.read(buf, off, len);
                    tally(n);
                    return n;
                }

                @Override
                public boolean isFinished() {
                    return delegate.isFinished();
                }

                @Override
                public boolean isReady() {
                    return delegate.isReady();
                }

                @Override
                public void setReadListener(ReadListener listener) {
                    delegate.setReadListener(listener);
                }
            };
        }
    }
}
