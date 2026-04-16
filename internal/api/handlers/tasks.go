package handlers

import (
	"database/sql"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/nemvince/fog-next/internal/api/middleware"
	"github.com/nemvince/fog-next/internal/api/response"
	"github.com/nemvince/fog-next/internal/models"
	"github.com/nemvince/fog-next/internal/plugins"
	"github.com/nemvince/fog-next/internal/store"
)

type Tasks struct {
	store   store.Store
	plugins *plugins.Registry
}

func NewTasks(st store.Store, reg *plugins.Registry) *Tasks { return &Tasks{st, reg} }

func (h *Tasks) List(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	filter := store.TaskFilter{
		State: q.Get("state"),
		Type:  q.Get("type"),
	}
	tasks, err := h.store.Tasks().ListTasks(r.Context(), filter, store.Page{Limit: 100})
	if err != nil {
		response.InternalError(w)
		return
	}
	response.OK(w, tasks)
}

func (h *Tasks) Get(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	task, err := h.store.Tasks().GetTask(r.Context(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			response.NotFound(w, "task")
			return
		}
		response.InternalError(w)
		return
	}
	response.OK(w, task)
}

func (h *Tasks) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFrom(r.Context())
	var task models.Task
	if !response.Decode(w, r, &task) {
		return
	}
	if task.HostID.String() == "" {
		response.BadRequest(w, "hostId is required")
		return
	}
	if task.Type == "" {
		response.BadRequest(w, "type is required")
		return
	}
	task.State = models.TaskStateQueued
	if claims != nil {
		task.CreatedBy = claims.Username
	}
	// Allow plugins to inspect or reject the task before persistence.
	if err := h.plugins.BeforeTaskCreate(r.Context(), &task); err != nil {
		response.Error(w, http.StatusUnprocessableEntity, "plugin rejected task", err.Error())
		return
	}
	if err := h.store.Tasks().CreateTask(r.Context(), &task); err != nil {
		response.InternalError(w)
		return
	}
	writeAudit(r.Context(), h.store, r, "create", "task", task.ID.String(), string(task.Type))
	response.Created(w, task)
}

func (h *Tasks) Cancel(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	if err := h.store.Tasks().CancelTask(r.Context(), id); err != nil {
		response.InternalError(w)
		return
	}
	writeAudit(r.Context(), h.store, r, "cancel", "task", id.String(), "")
	response.NoContent(w)
}

type progressUpdate struct {
	Percent          int   `json:"percent"`
	BitsPerMinute    int64 `json:"bitsPerMinute"`
	BytesTransferred int64 `json:"bytesTransferred"`
}

func (h *Tasks) UpdateProgress(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	task, err := h.store.Tasks().GetTask(r.Context(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			response.NotFound(w, "task")
			return
		}
		response.InternalError(w)
		return
	}

	var prog progressUpdate
	if !response.Decode(w, r, &prog) {
		return
	}

	task.PercentComplete = prog.Percent
	task.BitsPerMinute = prog.BitsPerMinute
	task.BytesTransferred = prog.BytesTransferred

	if prog.Percent >= 100 {
		task.State = models.TaskStateComplete
	} else if task.State == models.TaskStateQueued {
		task.State = models.TaskStateActive
	}

	if err := h.store.Tasks().UpdateTask(r.Context(), task); err != nil {
		response.InternalError(w)
		return
	}
	// Notify plugins once a task enters a terminal state.
	if task.State == models.TaskStateComplete || task.State == models.TaskStateFailed {
		_ = h.plugins.AfterTaskComplete(r.Context(), task)
	}
	response.OK(w, task)
}
