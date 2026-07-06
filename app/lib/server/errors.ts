import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class PublicApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "PublicApiError";
  }
}

export class ServerConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServerConfigError";
  }
}

export class PersistenceError extends Error {
  constructor(message = "Persistence failed") {
    super(message);
    this.name = "PersistenceError";
  }
}

export function publicErrorResponse(
  status: number,
  code: string,
  message: string,
) {
  return NextResponse.json(
    {
      ok: false,
      code,
      message,
    },
    { status },
  );
}

export function handleApiError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        ok: false,
        code: "invalid_submission",
        message: "Please check the form and try again.",
        fieldErrors: error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  if (error instanceof PublicApiError) {
    return publicErrorResponse(error.status, error.code, error.message);
  }

  if (error instanceof ServerConfigError) {
    console.error("[api] missing server configuration", {
      errorName: error.name,
      message: error.message,
    });

    return publicErrorResponse(
      503,
      "service_unavailable",
      "This form is temporarily unavailable. Please try again later.",
    );
  }

  if (error instanceof PersistenceError) {
    return publicErrorResponse(
      503,
      "save_failed",
      "We could not save this right now. Please try again later.",
    );
  }

  console.error("[api] unexpected route error", {
    errorName: error instanceof Error ? error.name : "UnknownError",
  });

  return publicErrorResponse(
    500,
    "server_error",
    "Something went wrong. Please try again later.",
  );
}
