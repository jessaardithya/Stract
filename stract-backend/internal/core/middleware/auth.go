package middleware

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"os"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

type JWKS struct {
	Keys []JWK `json:"keys"`
}

type JWK struct {
	Alg string `json:"alg"`
	Kid string `json:"kid"`
	Kty string `json:"kty"`
	X   string `json:"x"`
	Y   string `json:"y"`
	Crv string `json:"crv"`
}

var (
	cachedPubKey *ecdsa.PublicKey
	pubKeyMutex  sync.RWMutex
)

// getSupabasePublicKey lazily fetches the public key from the JWKS endpoint
func getSupabasePublicKey() (*ecdsa.PublicKey, error) {
	pubKeyMutex.RLock()
	if cachedPubKey != nil {
		defer pubKeyMutex.RUnlock()
		return cachedPubKey, nil
	}
	pubKeyMutex.RUnlock()

	pubKeyMutex.Lock()
	defer pubKeyMutex.Unlock()
	if cachedPubKey != nil {
		return cachedPubKey, nil
	}

	projectURL := os.Getenv("SUPABASE_URL")
	if projectURL == "" {
		return nil, fmt.Errorf("SUPABASE_URL environment variable is not set")
	}

	jwksURL := strings.TrimRight(projectURL, "/") + "/auth/v1/.well-known/jwks.json"
	resp, err := http.Get(jwksURL)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch JWKS: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("JWKS endpoint returned status %d", resp.StatusCode)
	}

	var jwks JWKS
	if err := json.NewDecoder(resp.Body).Decode(&jwks); err != nil {
		return nil, fmt.Errorf("failed to decode JWKS: %v", err)
	}

	for _, key := range jwks.Keys {
		if key.Kty == "EC" && key.Crv == "P-256" && key.X != "" && key.Y != "" {
			// Base64Url decode without padding
			xBytes, errX := base64.RawURLEncoding.DecodeString(key.X)
			yBytes, errY := base64.RawURLEncoding.DecodeString(key.Y)
			if errX == nil && errY == nil {
				pubKey := &ecdsa.PublicKey{
					Curve: elliptic.P256(),
					X:     new(big.Int).SetBytes(xBytes),
					Y:     new(big.Int).SetBytes(yBytes),
				}
				cachedPubKey = pubKey
				return pubKey, nil
			}
		}
	}

	return nil, fmt.Errorf("no valid EC public key found in JWKS")
}

// Auth is the "Security Guard" code.
// It intercepts HTTP requests to ensure they are properly authenticated.
func Auth() gin.HandlerFunc {
	return func(c *gin.Context) {
		log.Println("Auth middleware: verifying request...")

		// 1. Retrieve the Authorization header
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Missing Authorization header"})
			return
		}

		// 2. Strip the Bearer prefix to isolate the JWT
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid Authorization header format. Expected 'Bearer <token>'"})
			return
		}

		tokenString := parts[1]


		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			alg := token.Header["alg"]
			switch alg {
			case "HS256":
				// Handle legacy symmetric keys
				secret := os.Getenv("SUPABASE_JWT_SECRET")
				if secret == "" {
					return nil, fmt.Errorf("SUPABASE_JWT_SECRET environment variable is not set")
				}
				if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, fmt.Errorf("unexpected signing method for HS256: %v", token.Method.Alg())
				}
				return []byte(secret), nil

			case "ES256":
				// Handle modern asymmetric keys via JWKS
				if _, ok := token.Method.(*jwt.SigningMethodECDSA); !ok {
					return nil, fmt.Errorf("unexpected signing method for ES256: %v", token.Method.Alg())
				}
				pubKey, err := getSupabasePublicKey()
				if err != nil {
					return nil, fmt.Errorf("error fetching public key: %v", err)
				}
				return pubKey, nil

			default:
				return nil, fmt.Errorf("unsupported signing algorithm: %v", alg)
			}
		})

		if err != nil || !token.Valid {
			log.Printf("Auth middleware: token validation failed: %v", err)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			return
		}

		// 4. Extract the sub claim
		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			log.Println("Auth middleware: invalid token claims")
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid token claims"})
			return
		}

		sub, ok := claims["sub"].(string)
		if !ok || sub == "" {
			log.Println("Auth middleware: missing sub claim")
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid token subject"})
			return
		}

		// 5. Store the sub claim in the Gin context
		c.Set("user_id", sub)

		// Let the request proceed
		c.Next()
	}
}
