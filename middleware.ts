import { NextResponse, type NextRequest } from "next/server";

function harSesjon(request: NextRequest) {
  return request.cookies.getAll().some(
    (c) => c.name.startsWith("sb-") && c.name.includes("-auth-token")
  );
}

export function middleware(request: NextRequest) {
  const isAuthRoute = request.nextUrl.pathname.startsWith("/login");
  const loggetInn = harSesjon(request);

  if (!loggetInn && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (loggetInn && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
