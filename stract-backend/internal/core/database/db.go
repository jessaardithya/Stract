package database

import (
	"context"
	"fmt"
	"os"

	"github.com/jackc/pgx/v5"
)

// New initializes and returns a new database connection
func New() (*pgx.Conn, error) {
	connStr := os.Getenv("DATABASE_URL")
	if connStr == "" {
		return nil, fmt.Errorf("DATABASE_URL environment variable is not set")
	}

	db, err := pgx.Connect(context.Background(), connStr)
	if err != nil {
		return nil, fmt.Errorf("unable to connect to database: %w", err)
	}

	return db, nil
}
