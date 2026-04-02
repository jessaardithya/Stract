package main

import (
	"context"
	"fmt"
	"log"

	"stract-backend/internal/core/database"
	"github.com/joho/godotenv"
)

func main() {
	godotenv.Load()
	db, err := database.New()
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	var count int
	err = db.QueryRow(context.Background(), "SELECT COUNT(*) FROM stract.workspaces").Scan(&count)
	if err != nil {
		log.Printf("Error querying spaces: %v", err)
	} else {
		fmt.Printf("Total workspaces in stract.workspaces: %d\n", count)
	}

	rows, _ := db.Query(context.Background(), "SELECT name, slug, archived_at FROM stract.workspaces")
	defer rows.Close()
	for rows.Next() {
		var name, slug string
		var archivedAt *string
		rows.Scan(&name, &slug, &archivedAt)
		fmt.Printf("Workspace: Name=%s, Slug=%s, ArchivedAt=%v\n", name, slug, archivedAt)
	}
}
