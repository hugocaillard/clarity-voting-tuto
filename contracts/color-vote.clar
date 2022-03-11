(define-data-var nb-of-voters uint u0)

(define-public (vote)
  (begin
    (ok (var-set nb-of-voters (+ (var-get nb-of-voters) u1)))
  )
)

(define-read-only (get-nb-of-voters) (var-get nb-of-voters))
