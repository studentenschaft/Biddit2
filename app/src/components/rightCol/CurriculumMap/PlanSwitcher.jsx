import { useState, useRef, useEffect } from "react";
import { useRecoilValue } from "recoil";
import { planListSelector } from "../../recoil/curriculumPlansSelectors";
import usePlanManager from "../../helpers/usePlanManager";

const PlanSwitcher = () => {
  const plans = useRecoilValue(planListSelector);
  const { switchPlan, createPlan, deletePlan, renamePlan, duplicatePlan } = usePlanManager();

  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [contextMenu, setContextMenu] = useState(null); // { planId, name, x, y }
  const [deleteConfirm, setDeleteConfirm] = useState(null); // planId

  const editInputRef = useRef(null);
  const contextMenuRef = useRef(null);

  // Focus input when entering edit mode
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = (e) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target)) {
        setContextMenu(null);
        setDeleteConfirm(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [contextMenu]);

  const startRename = (planId, currentName) => {
    setEditingId(planId);
    setEditingName(currentName);
    setContextMenu(null);
  };

  const commitRename = () => {
    if (editingId && editingName.trim()) {
      renamePlan(editingId, editingName.trim());
    }
    setEditingId(null);
    setEditingName("");
  };

  const handleRenameKeyDown = (e) => {
    if (e.key === "Enter") commitRename();
    if (e.key === "Escape") {
      setEditingId(null);
      setEditingName("");
    }
  };

  const handleContextMenu = (e, planId, planName) => {
    e.preventDefault();
    setContextMenu({ planId, name: planName, x: e.clientX, y: e.clientY });
    setDeleteConfirm(null);
  };

  const handleCreatePlan = async () => {
    const activePlan = plans.find((p) => p.isActive);
    const baseName = activePlan ? activePlan.name : "Plan";
    await createPlan(`${baseName} (copy)`);
  };

  const handleDuplicate = async (planId) => {
    await duplicatePlan(planId);
    setContextMenu(null);
  };

  const handleDelete = async (planId) => {
    await deletePlan(planId);
    setContextMenu(null);
    setDeleteConfirm(null);
  };

  return (
    <div className="flex items-center gap-1 mt-3 pb-1">
      {/* Plan tabs */}
      <div className="flex items-center gap-1 min-w-0 overflow-x-auto">
        {plans.map((plan) => {
          const isEditing = editingId === plan.id;

          if (isEditing) {
            return (
              <input
                key={plan.id}
                ref={editInputRef}
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={commitRename}
                onKeyDown={handleRenameKeyDown}
                className="px-3 py-1 text-sm border border-blue-400 rounded outline-none bg-white min-w-[80px] max-w-[180px]"
                maxLength={40}
              />
            );
          }

          return (
            <button
              key={plan.id}
              onClick={() => !plan.isActive && switchPlan(plan.id)}
              onDoubleClick={() => startRename(plan.id, plan.name)}
              onContextMenu={(e) => handleContextMenu(e, plan.id, plan.name)}
              className={`
                px-3 py-1 text-sm rounded truncate max-w-[180px] transition-colors
                ${
                  plan.isActive
                    ? "bg-white text-gray-900 font-medium shadow-sm border border-gray-300"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-200"
                }
              `}
              title={plan.name}
            >
              {plan.name}
            </button>
          );
        })}
      </div>

      {/* Add plan button */}
      <button
        onClick={handleCreatePlan}
        className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded transition-colors"
        title="Create new plan (duplicate current)"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-4 h-4"
        >
          <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
        </svg>
      </button>

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[140px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
            onClick={() => startRename(contextMenu.planId, contextMenu.name)}
          >
            Rename
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
            onClick={() => handleDuplicate(contextMenu.planId)}
          >
            Duplicate
          </button>
          {plans.length > 1 && (
            <>
              <div className="border-t border-gray-100 my-1" />
              {deleteConfirm === contextMenu.planId ? (
                <div className="px-3 py-1.5">
                  <p className="text-xs text-gray-500 mb-1">Delete this plan?</p>
                  <div className="flex gap-1">
                    <button
                      className="px-2 py-0.5 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                      onClick={() => handleDelete(contextMenu.planId)}
                    >
                      Delete
                    </button>
                    <button
                      className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                      onClick={() => setDeleteConfirm(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                  onClick={() => setDeleteConfirm(contextMenu.planId)}
                >
                  Delete
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default PlanSwitcher;
